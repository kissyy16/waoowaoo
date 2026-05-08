import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const guardPath = join(process.cwd(), 'scripts/guards/task-submit-compensation-guard.mjs')

function runGuardWithRoutes(files: Record<string, string>): { stdout: string; stderr: string; status: number } {
  const root = mkdtempSync(join(tmpdir(), 'task-submit-guard-'))

  try {
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = join(root, relPath)
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, content, 'utf8')
    }

    try {
      const stdout = execFileSync(process.execPath, [guardPath], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { stdout, stderr: '', status: 0 }
    } catch (error) {
      const execError = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
      return {
        stdout: String(execError.stdout ?? ''),
        stderr: String(execError.stderr ?? ''),
        status: execError.status ?? 1,
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('task submit compensation guard', () => {
  it('passes routes that create data before submitTask and define rollback handling', () => {
    const result = runGuardWithRoutes({
      'src/app/api/novel-promotion/[projectId]/panel-variant/route.ts': `
        async function rollbackCreatedRecord() {}
        export const POST = apiHandler(async () => {
          await prisma.panel.create({ data: {} })
          try {
            return await submitTask({})
          } catch (error) {
            await rollbackCreatedRecord()
            throw error
          }
        })
      `,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[task-submit-compensation-guard] OK')
  })

  it('ignores routes that do not combine create and submitTask', () => {
    const result = runGuardWithRoutes({
      'src/app/api/user/api-config/route.ts': 'await submitTask({})',
      'src/app/api/projects/route.ts': 'await prisma.project.create({ data: {} })',
    })

    expect(result.status).toBe(0)
  })

  it('flags routes that create data before submitTask without compensation marker', () => {
    const result = runGuardWithRoutes({
      'src/app/api/example/route.ts': `
        export const POST = apiHandler(async () => {
          await prisma.panel.create({ data: {} })
          return await submitTask({})
        })
      `,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'src/app/api/example/route.ts creates data before submitTask without explicit rollback/compensation marker',
    )
  })
})
