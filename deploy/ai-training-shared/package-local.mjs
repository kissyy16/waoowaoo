import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../..')
const distDir = path.join(scriptDir, 'dist')
const outputFile = path.join(distDir, 'waoowaoo-server-package.tar.gz')
const imageTag = 'waoowaoo-local:latest'
let stagingDir = ''
const useExistingImage = process.argv.includes('--use-existing-image')

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

const nodeImageCandidates = unique([
  process.env.WAOO_NODE_IMAGE,
  'node:20-alpine',
  'docker.m.daocloud.io/library/node:20-alpine',
  'docker.1ms.run/library/node:20-alpine',
  'docker.1panel.live/library/node:20-alpine',
  'dockerpull.com/library/node:20-alpine',
  'public.ecr.aws/docker/library/node:20-alpine',
])
const npmRegistryCandidates = unique([
  process.env.WAOO_NPM_REGISTRY,
  'https://registry.npmmirror.com',
  'https://registry.npmjs.org',
  'https://mirrors.cloud.tencent.com/npm/',
  'https://repo.huaweicloud.com/repository/npm/',
])

const excludedDirs = new Set([
  '.git',
  'node_modules',
  '.next',
  'out',
  'coverage',
  'logs',
  'data',
  'docker-logs',
  '.tmp',
  '.idea',
  '.vscode',
  '.github',
  '.husky',
  'agent',
  'certificates',
  'deploy',
])

function shouldSkipFile(name) {
  return name === '.env'
    || name === '.env.local'
    || name === 'AGENTS.md'
    || name.endsWith('.log')
    || name.endsWith('.tsbuildinfo')
    || name === 'next-env.d.ts'
    || /^\.env\..*\.local$/.test(name)
}

async function copySource() {
  await cp(repoRoot, path.join(stagingDir, 'source'), {
    recursive: true,
    force: true,
    filter: async (src) => {
      const rel = path.relative(repoRoot, src)
      if (!rel) return true
      const parts = rel.split(path.sep)
      if (parts.some((part) => excludedDirs.has(part))) return false
      const info = await stat(src)
      if (info.isFile() && shouldSkipFile(path.basename(src))) return false
      return true
    },
  })
}

async function copyDeploy() {
  await cp(scriptDir, path.join(stagingDir, 'deploy'), {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(scriptDir, src)
      if (!rel) return true
      const first = rel.split(path.sep)[0]
      return first !== 'dist' && first !== '.package-tmp'
    },
  })
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 执行失败`)
  }
}

function buildLocalImage() {
  const tried = []
  const pulled = []
  for (const nodeImage of nodeImageCandidates) {
    console.log(`拉取 Node 基础镜像：${nodeImage}`)
    const pull = spawnSync('docker', ['pull', nodeImage], { stdio: 'inherit' })
    if (pull.status !== 0) {
      console.warn(`Node 基础镜像拉取失败，继续尝试下一个：${nodeImage}`)
      continue
    }

    pulled.push(nodeImage)
    for (const npmRegistry of npmRegistryCandidates) {
      const label = `${nodeImage} / ${npmRegistry}`
      tried.push(label)
      console.log(`开始本地构建镜像：${imageTag}`)
      console.log(`使用 Node 基础镜像：${nodeImage}`)
      console.log(`使用 npm registry：${npmRegistry}`)
      const result = spawnSync('docker', [
        'build',
        '--progress=plain',
        '--build-arg',
        `NODE_IMAGE=${nodeImage}`,
        '--build-arg',
        `NPM_REGISTRY=${npmRegistry}`,
        '-t',
        imageTag,
        repoRoot,
      ], { stdio: 'inherit' })
      if (result.status === 0) {
        console.log(`本地镜像构建成功：${imageTag}`)
        return
      }
      console.warn(`当前构建组合失败，继续尝试下一个 npm registry：${label}`)
    }

    console.warn(`基础镜像已可用，但所有 npm registry 构建均失败：${nodeImage}`)
    break
  }

  if (pulled.length === 0) {
    throw new Error(`Node 基础镜像全部拉取失败。已尝试：${nodeImageCandidates.join(', ')}`)
  }
  throw new Error(`本地镜像构建失败。已尝试：${tried.join('；')}。请查看上方第一条 npm ERR! 或 Docker build 失败日志。`)
}

async function main() {
  const tarCheck = spawnSync('tar', ['--version'], { stdio: 'ignore' })
  if (tarCheck.status !== 0) {
    throw new Error('未找到 tar 命令。请在 WebStorm 终端使用 Git Bash，或安装 bsdtar/tar 后重试。')
  }
  const dockerCheck = spawnSync('docker', ['--version'], { stdio: 'ignore' })
  if (dockerCheck.status !== 0) {
    throw new Error('未找到 docker 命令。请先启动本地 Docker Desktop，或安装 Docker CLI 后重试。')
  }

  stagingDir = await mkdtemp(path.join(os.tmpdir(), 'waoowaoo-package-'))
  await mkdir(stagingDir, { recursive: true })
  await mkdir(distDir, { recursive: true })
  if (existsSync(outputFile)) {
    await rm(outputFile, { force: true })
  }

  await copySource()
  await copyDeploy()

  if (useExistingImage) {
    const inspect = spawnSync('docker', ['image', 'inspect', imageTag], { stdio: 'ignore' })
    if (inspect.status !== 0) {
      throw new Error(`本地未找到镜像：${imageTag}。请先正常打包构建，或手动构建该镜像。`)
    }
    console.log(`复用本地已有镜像：${imageTag}`)
  } else {
    buildLocalImage()
  }

  const imageDir = path.join(stagingDir, 'image')
  await mkdir(imageDir, { recursive: true })
  console.log('导出镜像到发布包')
  run('docker', ['save', '-o', path.join(imageDir, 'waoowaoo-image-latest.tar'), imageTag])

  run('tar', ['-czf', outputFile, '-C', stagingDir, '.'])

  await rm(stagingDir, { recursive: true, force: true })
  console.log(`发布包已生成：${path.relative(repoRoot, outputFile)}`)
}

main().catch(async (error) => {
  if (stagingDir) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
