import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../helpers/request'

const txMock = vi.hoisted(() => ({
  account: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  userBalance: {
    upsert: vi.fn(),
  },
}))

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
}))

const encodeMock = vi.hoisted(() => vi.fn(async () => 'encoded-session-token'))
const logAuthActionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('next-auth/jwt', () => ({
  encode: encodeMock,
}))

vi.mock('@/lib/logging/semantic', () => ({
  logAuthAction: logAuthActionMock,
}))

describe('GET /[locale]/sso/consume', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    txMock.account.findUnique.mockResolvedValue(null)
    txMock.account.create.mockResolvedValue({})
    txMock.user.findUnique.mockResolvedValue(null)
    txMock.user.create.mockResolvedValue({ id: 'local-user-1', name: 'Alice', role: 'user' })
    txMock.userBalance.upsert.mockResolvedValue({})

    process.env.AI_TRAINING_SSO_VERIFY_URL = 'https://training.example.com/api/sso/ticket/verify'
    process.env.AI_TRAINING_SSO_CLIENT_ID = 'ai-video-workshop'
    process.env.AI_TRAINING_SSO_CLIENT_SECRET = 'client-secret'
    process.env.NEXTAUTH_SECRET = 'next-auth-secret'
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('verifies the ticket, creates a local session cookie, and redirects to returnTo', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      userId: 'platform-user-1',
      displayName: 'Alice',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const { GET } = await import('@/app/[locale]/sso/consume/route')
    const req = buildMockRequest({
      path: '/zh/sso/consume',
      method: 'GET',
      query: {
        ticket: 'ticket-1',
        returnTo: '/zh/home',
      },
    })

    const res = await GET(req, { params: Promise.resolve({ locale: 'zh' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/zh/home')
    expect(res.headers.get('set-cookie')).toContain('next-auth.session-token=encoded-session-token')
    expect(encodeMock).toHaveBeenCalledWith(expect.objectContaining({
      secret: 'next-auth-secret',
      token: expect.objectContaining({
        name: 'Alice',
        sub: 'local-user-1',
        id: 'local-user-1',
        role: 'user',
      }),
    }))
    expect(txMock.account.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'local-user-1',
        provider: 'ai-training-ticket-sso',
      }),
    }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to localized home when returnTo is not a same-site path', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      displayName: 'Alice',
    }), { status: 200 })) as unknown as typeof fetch)
    const { GET } = await import('@/app/[locale]/sso/consume/route')
    const req = buildMockRequest({
      path: '/zh/sso/consume',
      method: 'GET',
      query: {
        ticket: 'ticket-1',
        returnTo: 'https://evil.example.com/callback',
      },
    })

    const res = await GET(req, { params: Promise.resolve({ locale: 'zh' }) })

    expect(res.headers.get('location')).toBe('http://localhost:3000/zh/home')
  })

  it('redirects to sign-in and does not leak the ticket when verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 401,
      valid: false,
    }), { status: 401 })) as unknown as typeof fetch)
    const { GET } = await import('@/app/[locale]/sso/consume/route')
    const req = buildMockRequest({
      path: '/zh/sso/consume',
      method: 'GET',
      query: {
        ticket: 'secret-ticket',
        returnTo: '/zh/home',
      },
    })

    const res = await GET(req, { params: Promise.resolve({ locale: 'zh' }) })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/zh/auth/signin?error=SsoTicketInvalid')
    expect(encodeMock).not.toHaveBeenCalled()
    expect(txMock.account.create).not.toHaveBeenCalled()
    expect(JSON.stringify(logAuthActionMock.mock.calls)).not.toContain('secret-ticket')
  })

  it('uses NEXTAUTH_URL instead of 0.0.0.0 for redirects', async () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    const { GET } = await import('@/app/[locale]/sso/consume/route')
    const req = buildMockRequest({
      path: 'http://0.0.0.0:3000/zh/sso/consume',
      method: 'GET',
    })

    const res = await GET(req, { params: Promise.resolve({ locale: 'zh' }) })

    expect(res.headers.get('location')).toBe('http://localhost:3000/zh/auth/signin?error=SsoTicketInvalid')
  })

  it('keeps redirects on the incoming public origin so host-only cookies remain usable', async () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      displayName: 'Alice',
    }), { status: 200 })) as unknown as typeof fetch)
    const { GET } = await import('@/app/[locale]/sso/consume/route')
    const req = buildMockRequest({
      path: 'http://video-workshop.example.com/zh/sso/consume',
      method: 'GET',
      query: {
        ticket: 'ticket-1',
        returnTo: '/zh/home',
      },
    })

    const res = await GET(req, { params: Promise.resolve({ locale: 'zh' }) })

    expect(res.headers.get('location')).toBe('http://video-workshop.example.com/zh/home')
  })

  it('uses forwarded host when the app is behind a reverse proxy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      displayName: 'Alice',
    }), { status: 200 })) as unknown as typeof fetch)
    const { GET } = await import('@/app/[locale]/sso/consume/route')
    const req = buildMockRequest({
      path: 'http://127.0.0.1:3000/zh/sso/consume',
      method: 'GET',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'video-workshop.example.com',
      },
      query: {
        ticket: 'ticket-1',
        returnTo: '/zh/home',
      },
    })

    const res = await GET(req, { params: Promise.resolve({ locale: 'zh' }) })

    expect(res.headers.get('location')).toBe('https://video-workshop.example.com/zh/home')
  })
})
