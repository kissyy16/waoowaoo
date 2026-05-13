import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveConfigMock = vi.hoisted(() => vi.fn(async () => ({
  providerId: 'openai-compatible:33331fb0-2806-4da6-85ff-cd2433b587d0',
  baseUrl: 'https://compat.example.com/v1',
  apiKey: 'sk-test',
})))

vi.mock('@/lib/model-gateway/openai-compat/common', () => ({
  resolveOpenAICompatClientConfig: resolveConfigMock,
}))

import { generateVideoViaOpenAICompatTemplate } from '@/lib/model-gateway/openai-compat/template-video'

describe('openai-compat template video externalId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('encodes compact modelId token for OCOMPAT externalId', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      id: 'veo3.1-fast:1772734762-6TuDIS8Vvr',
      status: 'pending',
    }), { status: 200 })) as unknown as typeof fetch

    const result = await generateVideoViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:33331fb0-2806-4da6-85ff-cd2433b587d0',
      modelId: 'veo3.1-fast',
      modelKey: 'openai-compatible:33331fb0-2806-4da6-85ff-cd2433b587d0::veo3.1-fast',
      imageUrl: 'https://example.com/seed.png',
      prompt: 'animate this image',
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'video',
        mode: 'async',
        create: {
          method: 'POST',
          path: '/video/create',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
          },
        },
        status: {
          method: 'GET',
          path: '/video/query?id={{task_id}}',
        },
        response: {
          taskIdPath: '$.id',
          statusPath: '$.status',
        },
        polling: {
          intervalMs: 5000,
          timeoutMs: 600000,
          doneStates: ['completed'],
          failStates: ['failed'],
        },
      },
    })

    expect(result.success).toBe(true)
    expect(result.async).toBe(true)
    expect(result.externalId).toContain(':u_33331fb0-2806-4da6-85ff-cd2433b587d0:')
    expect(result.externalId).toContain(`:${Buffer.from('veo3.1-fast', 'utf8').toString('base64url')}:`)
    expect(result.externalId).not.toContain(Buffer.from('openai-compatible:33331fb0-2806-4da6-85ff-cd2433b587d0::veo3.1-fast', 'utf8').toString('base64url'))
    expect(result.externalId!.length).toBeLessThanOrEqual(128)
  })

  it('derives template size from resolution and aspect ratio', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      void _url
      void _init
      return new Response(JSON.stringify({
        id: 'task-size',
        status: 'pending',
      }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await generateVideoViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:33331fb0-2806-4da6-85ff-cd2433b587d0',
      modelId: 'doubao-seedance-2-0-260128',
      modelKey: 'openai-compatible:33331fb0-2806-4da6-85ff-cd2433b587d0::doubao-seedance-2-0-260128',
      imageUrl: 'https://example.com/seed.png',
      prompt: 'animate this image',
      profile: 'openai-compatible',
      options: {
        duration: 6,
        resolution: '720p',
        aspectRatio: '9:16',
      },
      template: {
        version: 1,
        mediaType: 'video',
        mode: 'async',
        create: {
          method: 'POST',
          path: '/videos',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
            seconds: '{{duration}}',
            size: '{{size}}',
            input_reference: '{{image}}',
          },
        },
        status: {
          method: 'GET',
          path: '/videos/{{task_id}}',
        },
        response: {
          taskIdPath: '$.id',
          statusPath: '$.status',
        },
        polling: {
          intervalMs: 5000,
          timeoutMs: 600000,
          doneStates: ['completed'],
          failStates: ['failed'],
        },
      },
    })

    const firstCall = fetchMock.mock.calls[0]
    const body = JSON.parse(String(firstCall?.[1]?.body || '{}'))
    expect(body).toMatchObject({
      seconds: 6,
      size: '720x1280',
      input_reference: 'https://example.com/seed.png',
    })
  })
})
