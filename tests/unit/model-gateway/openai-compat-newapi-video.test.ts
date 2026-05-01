import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveConfigMock = vi.hoisted(() => vi.fn(async () => ({
  providerId: 'openai-compatible:oa-1',
  baseUrl: 'https://compat.example.com/v1',
  apiKey: 'sk-test',
})))

vi.mock('@/lib/model-gateway/openai-compat/common', () => ({
  resolveOpenAICompatClientConfig: resolveConfigMock,
}))

import {
  generateVideoViaNewApiCompat,
  isNewApiSeedanceVideoModel,
  isOpenAISoraStyleVideoTemplate,
} from '@/lib/model-gateway/openai-compat/newapi-video'

describe('openai-compat New API video adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts JSON to New API video generation endpoint and returns NEWAPI externalId', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url
      void init
      return new Response(JSON.stringify({
        task_id: 'task-123',
        status: 'queued',
      }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await generateVideoViaNewApiCompat({
      userId: 'user-1',
      providerId: 'openai-compatible:oa-1',
      modelId: 'doubao-seedance-2.0',
      modelKey: 'openai-compatible:oa-1::doubao-seedance-2.0',
      imageUrl: 'data:image/png;base64,QQ==',
      prompt: 'animate this image',
      profile: 'openai-compatible',
      options: {
        duration: 5,
        fps: 24,
        aspectRatio: '16:9',
        resolution: '720p',
      },
    })

    expect(result.success).toBe(true)
    expect(result.async).toBe(true)
    expect(result.requestId).toBe('task-123')
    expect(result.externalId).toBe(
      `NEWAPI:VIDEO:b64_${Buffer.from('openai-compatible:oa-1', 'utf8').toString('base64url')}:task-123`,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0]
    expect(firstCall).toBeTruthy()
    if (!firstCall) {
      throw new Error('fetch should be called')
    }
    const [url, init] = firstCall
    expect(url).toBe('https://compat.example.com/v1/video/generations')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-test',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'doubao-seedance-2.0',
      prompt: 'animate this image',
      image: 'data:image/png;base64,QQ==',
      duration: 5,
      fps: 24,
      width: 1280,
      height: 720,
      metadata: {
        aspect_ratio: '16:9',
        resolution: '720p',
      },
    })
  })

  it('recognizes New API Seedance model ids and legacy Sora-style templates', () => {
    expect(isNewApiSeedanceVideoModel('doubao-seedance-2.0')).toBe(true)
    expect(isNewApiSeedanceVideoModel('doubao-seedance-2-0-fast-260128')).toBe(true)
    expect(isNewApiSeedanceVideoModel('sora-2')).toBe(false)

    expect(isOpenAISoraStyleVideoTemplate({
      version: 1,
      mediaType: 'video',
      mode: 'async',
      create: {
        method: 'POST',
        path: '/v1/videos',
        contentType: 'multipart/form-data',
        multipartFileFields: ['input_reference'],
        bodyTemplate: {
          model: '{{model}}',
          prompt: '{{prompt}}',
          input_reference: '{{image}}',
        },
      },
      status: {
        method: 'GET',
        path: '/v1/videos/{{task_id}}',
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
    })).toBe(true)
  })
})
