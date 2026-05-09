import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'
import {
  installAuthMocks,
  mockAuthenticated,
  resetAuthMockState,
} from '../../../helpers/auth'

type UserPreferenceSnapshot = {
  customProviders: string | null
  customModels: string | null
}

const prismaMock = vi.hoisted(() => ({
  userPreference: {
    findUnique: vi.fn<(...args: unknown[]) => Promise<UserPreferenceSnapshot | null>>(),
    upsert: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  },
}))

const encryptApiKeyMock = vi.hoisted(() => vi.fn((value: string) => `enc:${value}`))
const decryptApiKeyMock = vi.hoisted(() => vi.fn((value: string) => value.replace(/^enc:/, '')))
const getBillingModeMock = vi.hoisted(() => vi.fn(async () => 'OFF'))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/crypto-utils', () => ({
  encryptApiKey: encryptApiKeyMock,
  decryptApiKey: decryptApiKeyMock,
}))

vi.mock('@/lib/billing/mode', () => ({
  getBillingMode: getBillingModeMock,
}))

const routeContext = { params: Promise.resolve({}) }

function readSavedModelsFromUpsert(): Array<Record<string, unknown>> {
  const firstCall = prismaMock.userPreference.upsert.mock.calls[0]
  if (!firstCall) {
    throw new Error('expected prisma.userPreference.upsert to be called')
  }

  const payload = firstCall[0] as { update?: { customModels?: unknown } }
  const rawModels = payload.update?.customModels
  if (typeof rawModels !== 'string') {
    throw new Error('expected update.customModels to be a JSON string')
  }

  const parsed = JSON.parse(rawModels) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('expected update.customModels to parse as an array')
  }
  return parsed as Array<Record<string, unknown>>
}

describe('api contract - user api-config route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetAuthMockState()

    prismaMock.userPreference.findUnique.mockResolvedValue({
      customProviders: null,
      customModels: null,
    })
    prismaMock.userPreference.upsert.mockResolvedValue({ id: 'pref-1' })
    getBillingModeMock.mockResolvedValue('OFF')
  })

  it('backfills image edit template for openai-compatible image models', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          {
            id: 'openai-compatible:oa-1',
            name: 'OpenAI Compat',
            baseUrl: 'https://compat.test/v1',
            apiKey: 'oa-key',
          },
        ],
        models: [
          {
            modelId: 'gpt-image-2',
            modelKey: 'openai-compatible:oa-1::gpt-image-2',
            name: 'GPT Image 2',
            type: 'image',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)

    expect(res.status).toBe(200)
    const savedModels = readSavedModelsFromUpsert()
    const savedModel = savedModels.find((item) => item.modelKey === 'openai-compatible:oa-1::gpt-image-2')
    expect(savedModel?.compatMediaEditTemplate).toMatchObject({
      mediaType: 'image',
      mode: 'sync',
      create: {
        path: '/images/edits',
        contentType: 'multipart/form-data',
        multipartFileFields: ['image'],
        bodyTemplate: {
          image: '{{images}}',
        },
      },
    })
    expect(savedModel?.compatMediaEditTemplateSource).toBe('manual')
  })
})
