import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'openai-compatible:oa-1',
  apiKey: 'oa-key',
  baseUrl: 'https://newapi.test/v1',
})))

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

import { pollAsyncTask } from '@/lib/async-poll'

const PROVIDER_TOKEN = `b64_${Buffer.from('openai-compatible:oa-1', 'utf8').toString('base64url')}`

describe('async poll NEWAPI video status mapping', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    getProviderConfigMock.mockResolvedValue({
      id: 'openai-compatible:oa-1',
      apiKey: 'oa-key',
      baseUrl: 'https://newapi.test/v1',
    })
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  it('maps New API succeeded response to video url', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      task_id: 'task-123',
      status: 'succeeded',
      url: 'https://cdn.example.com/video.mp4',
    }), { status: 200 }))

    const result = await pollAsyncTask(`NEWAPI:VIDEO:${PROVIDER_TOKEN}:task-123`, 'user-1')

    expect(fetchSpy).toHaveBeenCalledWith('https://newapi.test/v1/video/generations/task-123', {
      method: 'GET',
      headers: { Authorization: 'Bearer oa-key' },
    })
    expect(result).toEqual({
      status: 'completed',
      resultUrl: 'https://cdn.example.com/video.mp4',
      videoUrl: 'https://cdn.example.com/video.mp4',
    })
  })

  it('maps New API processing and failed statuses', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'processing',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'failed',
        error: { message: 'Invalid parameters' },
      }), { status: 200 }))

    const pending = await pollAsyncTask(`NEWAPI:VIDEO:${PROVIDER_TOKEN}:task-pending`, 'user-1')
    const failed = await pollAsyncTask(`NEWAPI:VIDEO:${PROVIDER_TOKEN}:task-failed`, 'user-1')

    expect(pending).toEqual({ status: 'pending' })
    expect(failed).toEqual({ status: 'failed', error: 'Invalid parameters' })
  })

  it('maps nested New API status response shapes', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          task_id: 'task-nested',
          status: 'completed',
          url: 'https://cdn.example.com/nested.mp4',
        },
      }), { status: 200 }))

    const result = await pollAsyncTask(`NEWAPI:VIDEO:${PROVIDER_TOKEN}:task-nested`, 'user-1')

    expect(result).toEqual({
      status: 'completed',
      resultUrl: 'https://cdn.example.com/nested.mp4',
      videoUrl: 'https://cdn.example.com/nested.mp4',
    })
  })

  it('maps provider-compatible nested video output shapes', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'COMPLETED',
        video: {
          url: 'https://cdn.example.com/video-object.mp4',
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          status: 'COMPLETED',
          output: {
            video: {
              url: 'https://cdn.example.com/data-output-video.mp4',
            },
          },
        },
      }), { status: 200 }))

    const rootVideo = await pollAsyncTask(`NEWAPI:VIDEO:${PROVIDER_TOKEN}:task-video-object`, 'user-1')
    const dataOutputVideo = await pollAsyncTask(`NEWAPI:VIDEO:${PROVIDER_TOKEN}:task-data-output`, 'user-1')

    expect(rootVideo).toEqual({
      status: 'completed',
      resultUrl: 'https://cdn.example.com/video-object.mp4',
      videoUrl: 'https://cdn.example.com/video-object.mp4',
    })
    expect(dataOutputVideo).toEqual({
      status: 'completed',
      resultUrl: 'https://cdn.example.com/data-output-video.mp4',
      videoUrl: 'https://cdn.example.com/data-output-video.mp4',
    })
  })
})
