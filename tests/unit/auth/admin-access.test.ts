import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../helpers/request'

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}))
const comparePasswordMock = vi.hoisted(() => vi.fn())
const hashPasswordMock = vi.hoisted(() => vi.fn())
const checkRateLimitMock = vi.hoisted(() => vi.fn())
const logAuthActionMock = vi.hoisted(() => vi.fn())
const getServerSessionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@next-auth/prisma-adapter', () => ({
  PrismaAdapter: vi.fn(() => ({})),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn((options) => ({
    id: 'credentials',
    type: 'credentials',
    ...options,
  })),
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: comparePasswordMock,
    hash: hashPasswordMock,
  },
  compare: comparePasswordMock,
  hash: hashPasswordMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  AUTH_REGISTER_LIMIT: { limit: 5, windowSeconds: 60 },
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('@/lib/logging/semantic', () => ({
  logAuthAction: logAuthActionMock,
}))

async function loadAuthOptions() {
  const mod = await import('@/lib/auth')
  return mod.authOptions
}

describe('admin-only auth access', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.AUTH_REGISTRATION_ENABLED
    delete process.env.AUTH_ALLOW_NON_ADMIN_LOGIN
  })

  it('keeps registration disabled by default before rate limit or database work', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = buildMockRequest({
      path: '/api/auth/register',
      method: 'POST',
      body: { name: 'new-user', password: 'secret1' },
    })

    const res = await POST(req, { params: Promise.resolve({}) })
    const payload = await res.json() as { code?: string; error?: { code?: string } }

    expect(res.status).toBe(403)
    expect(payload.error?.code).toBe('FORBIDDEN')
    expect(payload.code).toBe('REGISTRATION_DISABLED')
    expect(checkRateLimitMock).not.toHaveBeenCalled()
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects regular users from credentials login by default', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'user',
      password: 'hashed',
      role: 'user',
    })
    comparePasswordMock.mockResolvedValue(true)

    const authOptions = await loadAuthOptions()
    const result = await authOptions.providers[0].authorize({ username: 'user', password: 'secret1' })

    expect(result).toBeNull()
    expect(logAuthActionMock).toHaveBeenCalledWith(
      'LOGIN',
      'user',
      expect.objectContaining({ userId: 'user-1', role: 'user', error: 'Admin role required' }),
    )
  })

  it('allows admin users through credentials login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      name: 'admin',
      password: 'hashed',
      role: 'admin',
    })
    comparePasswordMock.mockResolvedValue(true)

    const authOptions = await loadAuthOptions()
    const result = await authOptions.providers[0].authorize({ username: 'admin', password: 'secret1' })

    expect(result).toEqual({ id: 'admin-1', name: 'admin', role: 'admin' })
  })

  it('refreshes session role from database instead of trusting a stale token role', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'admin' })

    const authOptions = await loadAuthOptions()
    const session = await authOptions.callbacks.session({
      session: { user: { name: 'admin' } },
      token: { id: 'admin-1', role: 'user' },
    })

    expect(session.user).toMatchObject({ id: 'admin-1', role: 'admin' })
  })

  it('rejects stale regular sessions at API auth gates in private mode', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1', role: 'user' } })
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'user',
      email: null,
      role: 'user',
    })

    const { requireUserAuth, isErrorResponse } = await import('@/lib/api-auth')
    const result = await requireUserAuth()

    expect(isErrorResponse(result)).toBe(true)
    if (isErrorResponse(result)) {
      expect(result.status).toBe(403)
    }
  })

  it('allows regular sessions at API auth gates only when explicitly enabled', async () => {
    process.env.AUTH_ALLOW_NON_ADMIN_LOGIN = 'true'
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1', role: 'user' } })
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'user',
      email: null,
      role: 'user',
    })

    const { requireUserAuth } = await import('@/lib/api-auth')
    const result = await requireUserAuth()

    expect(result).toEqual({
      session: {
        user: {
          id: 'user-1',
          name: 'user',
          email: null,
          role: 'user',
        },
      },
    })
  })
})
