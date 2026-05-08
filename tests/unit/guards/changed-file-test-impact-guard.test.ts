import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const guardPath = join(process.cwd(), 'scripts/guards/changed-file-test-impact-guard.mjs')

function runGuard(files: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [guardPath, ...files], {
      cwd: process.cwd(),
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
}

describe('changed-file-test-impact-guard', () => {
  it('requires api changes to be paired with contract, system, or regression tests', () => {
    const result = runGuard([
      'src/app/api/novel-promotion/[projectId]/generate-image/route.ts',
    ])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'api: changing src/app/api/** requires a matching contract, system, or regression test change; sources=src/app/api/novel-promotion/[projectId]/generate-image/route.ts',
    )
  })

  it('accepts worker changes when system tests are updated together', () => {
    const result = runGuard([
      'src/lib/workers/image.worker.ts',
      'tests/system/generate-image.system.test.ts',
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[changed-file-test-impact-guard] OK')
  })

  it('accepts provider changes when provider contract coverage is updated', () => {
    const result = runGuard([
      'src/lib/model-gateway/openai-compat/image.ts',
      'tests/unit/model-gateway/openai-compat-template-image-output-urls.test.ts',
    ])

    expect(result.status).toBe(0)
  })
})
