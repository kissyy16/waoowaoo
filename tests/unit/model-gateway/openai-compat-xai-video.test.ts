import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveConfigMock = vi.hoisted(() => vi.fn(async () => ({
  providerId: 'openai-compatible:oa-1',
  baseUrl: 'https://api.x.ai/v1',
  apiKey: 'sk-test',
})))

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'openai-compatible:oa-1',
  apiKey: 'sk-test',
  baseUrl: 'https://api.x.ai/v1',
})))

vi.mock('@/lib/model-gateway/openai-compat/common', () => ({
  resolveOpenAICompatClientConfig: resolveConfigMock,
}))

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
  getUserModels: vi.fn(async () => []),
}))

import { pollAsyncTask } from '@/lib/async-poll'
import {
  generateVideoViaXAICompat,
  isXaiGrokVideoModel,
} from '@/lib/model-gateway/openai-compat/xai-video'

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

describe('openai-compat xAI Grok video adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn() as unknown as typeof fetch
  })

  it('posts xAI JSON body with integer duration and no seconds field', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url
      void init
      return new Response(JSON.stringify({
      request_id: 'xai-task-1',
      status: 'pending',
      }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await generateVideoViaXAICompat({
      userId: 'user-1',
      providerId: 'openai-compatible:oa-1',
      modelId: 'grok-imagine-video',
      modelKey: 'openai-compatible:oa-1::grok-imagine-video',
      imageUrl: 'data:image/png;base64,QQ==',
      prompt: 'animate this image',
      profile: 'openai-compatible',
      options: {
        duration: 7.4,
        aspectRatio: '16:9',
        resolution: '720p',
      },
    })

    expect(result).toMatchObject({
      success: true,
      async: true,
      requestId: 'xai-task-1',
      externalId: `XAI:VIDEO:b64_${encode('openai-compatible:oa-1')}:xai-task-1`,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0]
    expect(firstCall).toBeTruthy()
    if (!firstCall) {
      throw new Error('fetch should be called')
    }
    const [url, init] = firstCall
    expect(url).toBe('https://api.x.ai/v1/videos/generations')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-test',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'grok-imagine-video',
      prompt: 'animate this image',
      image: { url: 'data:image/png;base64,QQ==' },
      duration: 7,
      aspect_ratio: '16:9',
      resolution: '720p',
    })
    expect(String(init?.body)).not.toContain('seconds')
  })

  it('recognizes Grok video model ids and polls done status output', async () => {
    expect(isXaiGrokVideoModel('grok-imagine-video')).toBe(true)
    expect(isXaiGrokVideoModel('grok-image-video')).toBe(true)
    expect(isXaiGrokVideoModel('doubao-seedance-2.0')).toBe(false)

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url
      void init
      return new Response(JSON.stringify({
      request_id: 'xai-task-2',
      status: 'done',
      video: {
        url: 'https://cdn.example.com/grok-video.mp4',
      },
      }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await pollAsyncTask(
      `XAI:VIDEO:b64_${encode('openai-compatible:oa-1')}:xai-task-2`,
      'user-1',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.x.ai/v1/videos/xai-task-2',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer sk-test' },
      },
    )
    expect(result).toEqual({
      status: 'completed',
      videoUrl: 'https://cdn.example.com/grok-video.mp4',
      resultUrl: 'https://cdn.example.com/grok-video.mp4',
    })
  })
})
