import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const guardPath = join(process.cwd(), 'scripts/guards/image-reference-normalization-guard.mjs')

function runGuardWithHandlers(files: Record<string, string>): { stdout: string; stderr: string; status: number } {
  const root = mkdtempSync(join(tmpdir(), 'image-reference-guard-'))

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

describe('image reference normalization guard', () => {
  it('allows shared helper exceptions explicitly', () => {
    const result = runGuardWithHandlers({
      'src/lib/workers/handlers/image-task-handler-shared.ts': `
        resolveImageSourceFromGeneration(job, { options: { referenceImages: refs } })
      `,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[image-reference-normalization-guard] OK')
  })

  it('passes handlers that normalize reference images before generation', () => {
    const result = runGuardWithHandlers({
      'src/lib/workers/handlers/panel-image-task-handler.ts': `
        import { normalizeReferenceImagesForGeneration } from '@/lib/media/outbound-image'
        async function run() {
          const normalizedRefs = await normalizeReferenceImagesForGeneration(refs)
          return await resolveImageSourceFromGeneration(job, {
            options: {
              referenceImages: normalizedRefs,
            },
          })
        }
      `,
    })

    expect(result.status).toBe(0)
  })

  it('flags handlers that send referenceImages without normalization markers', () => {
    const result = runGuardWithHandlers({
      'src/lib/workers/handlers/bad-handler.ts': `
        async function run() {
          return await resolveImageSourceFromGeneration(job, {
            options: {
              referenceImages: refs,
            },
          })
        }
      `,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'src/lib/workers/handlers/bad-handler.ts uses resolveImageSourceFromGeneration with referenceImages but does not reference normalizeReferenceImagesForGeneration/normalizeToBase64ForGeneration/generateProjectLabeledImageToStorage/generateCleanImageToStorage',
    )
  })
})
