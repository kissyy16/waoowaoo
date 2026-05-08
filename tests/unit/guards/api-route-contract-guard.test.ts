import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const guardPath = join(process.cwd(), 'scripts/guards/api-route-contract-guard.mjs')

function runGuardWithRoutes(files: Record<string, string>): { stdout: string; stderr: string; status: number } {
  const root = mkdtempSync(join(tmpdir(), 'api-route-guard-'))

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

describe('api route contract guard', () => {
  it('allows explicit public and framework-managed exceptions', () => {
    const result = runGuardWithRoutes({
      'src/app/api/system/boot-id/route.ts': 'export async function GET() { return Response.json({ bootId: "x" }) }',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[api-route-contract-guard] OK')
  })

  it('passes protected routes that use apiHandler and explicit user auth', () => {
    const result = runGuardWithRoutes({
      'src/app/api/user/secure/route.ts': `
        import { requireUserAuth } from '@/lib/api-auth'
        import { apiHandler } from '@/lib/api-errors'
        export const GET = apiHandler(async () => {
          await requireUserAuth()
          return Response.json({ ok: true })
        })
      `,
    })

    expect(result.status).toBe(0)
  })

  it('passes admin-only routes that use requireAdminAuth', () => {
    const result = runGuardWithRoutes({
      'src/app/api/admin/secure/route.ts': `
        import { requireAdminAuth } from '@/lib/api-auth'
        import { apiHandler } from '@/lib/api-errors'
        export const GET = apiHandler(async () => {
          await requireAdminAuth()
          return Response.json({ ok: true })
        })
      `,
    })

    expect(result.status).toBe(0)
  })

  it('flags protected routes that skip apiHandler or auth', () => {
    const result = runGuardWithRoutes({
      'src/app/api/user/missing-handler/route.ts': `
        import { requireUserAuth } from '@/lib/api-auth'
        export async function GET() {
          await requireUserAuth()
          return Response.json({ ok: true })
        }
      `,
      'src/app/api/user/missing-auth/route.ts': `
        import { apiHandler } from '@/lib/api-errors'
        export const GET = apiHandler(async () => Response.json({ ok: true }))
      `,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('src/app/api/user/missing-handler/route.ts missing apiHandler wrapper')
    expect(result.stderr).toContain(
      'src/app/api/user/missing-auth/route.ts missing requireAdminAuth/requireUserAuth/requireProjectAuth/requireProjectAuthLight',
    )
  })
})
