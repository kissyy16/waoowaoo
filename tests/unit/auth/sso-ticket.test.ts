import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSsoProviderAccountId,
  buildTicketVerifySignature,
  resolveSsoDisplayName,
  sha256Hex,
  verifyAiTrainingSsoTicket,
} from '@/lib/sso/ticket'

describe('AI training ticket SSO helpers', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-09T16:00:00.000Z'))
    process.env.AI_TRAINING_SSO_VERIFY_URL = 'https://training.example.com/api/sso/ticket/verify'
    process.env.AI_TRAINING_SSO_CLIENT_ID = 'ai-video-workshop'
    process.env.AI_TRAINING_SSO_CLIENT_SECRET = 'client-secret'
    process.env.AI_TRAINING_SSO_TIMEOUT_MS = '5000'
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('builds the fixed sha256 and HMAC signature payload', () => {
    const body = '{"ticket":"ticket-1"}'

    expect(sha256Hex(body)).toBe('b885d79574f2777648e36d2b80606bc343bdea976b2502038207571e7e6c4e70')
    expect(buildTicketVerifySignature({
      method: 'POST',
      path: '/api/sso/ticket/verify',
      timestamp: '1710000000000',
      nonce: 'abc123',
      body,
      clientSecret: 'client-secret',
    })).toBe('79d8bc842dca2d4dedb340c6da61c5bf9e9204a7315fce8f69d9a6a2cd6b60ca')
  })

  it('chooses display name by the agreed field priority', () => {
    expect(resolveSsoDisplayName({
      userName: 'user-name',
      username: 'username',
      preferredUsername: 'preferred',
      displayName: 'display',
      name: 'name',
    })).toBe('name')
    expect(resolveSsoDisplayName({ userName: 'user-name', username: 'username' })).toBe('username')
  })

  it('creates a stable opaque provider account id without exposing source identifiers', () => {
    const first = buildSsoProviderAccountId({ valid: true, tenantId: 'tenant-1', sub: 'sub-1', userId: 'user-1' })
    const second = buildSsoProviderAccountId({ valid: true, tenantId: 'tenant-1', sub: 'sub-1', userId: 'user-1' })

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(first).not.toContain('sub-1')
  })

  it('calls the verify endpoint with signed headers and JSON body', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      userId: 'user-1',
      displayName: 'Alice',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const profile = await verifyAiTrainingSsoTicket('ticket-1')

    expect(profile.displayName).toBe('Alice')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(url).toBe('https://training.example.com/api/sso/ticket/verify')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"ticket":"ticket-1"}')
    expect(headers['X-Sso-Client-Id']).toBe('ai-video-workshop')
    expect(headers['X-Sso-Timestamp']).toBe('1710000000000')
    expect(headers['X-Sso-Nonce']).toMatch(/^[a-f0-9]{32}$/)
    expect(headers['X-Sso-Signature']).toMatch(/^[a-f0-9]{64}$/)
  })

  it('allows proxy verify URL and backend signature path to differ', async () => {
    process.env.AI_TRAINING_SSO_VERIFY_URL = 'http://127.0.0.1/dev-api/api/sso/ticket/verify'
    process.env.AI_TRAINING_SSO_SIGNATURE_PATH = '/api/sso/ticket/verify'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      displayName: 'Alice',
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    await verifyAiTrainingSsoTicket('ticket-1')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    const expectedSignature = buildTicketVerifySignature({
      method: 'POST',
      path: '/api/sso/ticket/verify',
      timestamp: '1710000000000',
      nonce: headers['X-Sso-Nonce'],
      body: '{"ticket":"ticket-1"}',
      clientSecret: 'client-secret',
    })
    expect(url).toBe('http://127.0.0.1/dev-api/api/sso/ticket/verify')
    expect(headers['X-Sso-Signature']).toBe(expectedSignature)
  })

  it('accepts a wrapped successful verify payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      msg: 'success',
      data: {
        valid: true,
        tenantId: 'tenant-1',
        sub: 'sub-1',
        displayName: 'Alice',
      },
    }), { status: 200 })) as unknown as typeof fetch)

    const profile = await verifyAiTrainingSsoTicket('ticket-1')

    expect(profile).toMatchObject({
      valid: true,
      tenantId: 'tenant-1',
      sub: 'sub-1',
      displayName: 'Alice',
    })
  })

  it('includes only safe payload summary when a 200 response says the ticket is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 401,
      msg: 'ticket expired',
      valid: false,
      ticket: 'should-not-be-logged',
      mobile: '13800138000',
    }), { status: 200 })) as unknown as typeof fetch)

    await expect(verifyAiTrainingSsoTicket('ticket-1')).rejects.toMatchObject({
      code: 'TICKET_INVALID',
      status: 200,
      details: {
        verifyHost: 'training.example.com',
        verifyPath: '/api/sso/ticket/verify',
        responseCode: 401,
        responseMessage: 'ticket expired',
        responseValid: false,
      },
    })
  })

  it('rejects expired or repeated tickets without returning profile data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 401,
      valid: false,
    }), { status: 401 })) as unknown as typeof fetch)

    await expect(verifyAiTrainingSsoTicket('ticket-1')).rejects.toMatchObject({
      code: 'TICKET_INVALID',
      status: 401,
    })
  })

  it('reports non-JSON HTTP failures as HTTP errors with safe endpoint details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<h1>not found</h1>', { status: 404 })) as unknown as typeof fetch)

    await expect(verifyAiTrainingSsoTicket('ticket-1')).rejects.toMatchObject({
      code: 'VERIFY_HTTP_ERROR',
      status: 404,
      details: expect.objectContaining({
        verifyHost: 'training.example.com',
        verifyProtocol: 'https',
        verifyPort: '443',
        verifyPath: '/api/sso/ticket/verify',
        responseJson: false,
      }),
    })
  })
})
