import { describe, expect, it } from 'vitest'
import { readNewApiVideoUrl } from '@/lib/async-poll'

describe('readNewApiVideoUrl', () => {
  it('reads array output returned by NEWAPI-style gateways', () => {
    expect(
      readNewApiVideoUrl({
        status: 'succeeded',
        data: {
          output: ['https://cdn.example.com/video/output.mp4'],
        },
      }),
    ).toBe('https://cdn.example.com/video/output.mp4')
  })

  it('reads nested result object urls', () => {
    expect(
      readNewApiVideoUrl({
        data: {
          status: 'completed',
          result: [
            {
              url: 'https://cdn.example.com/tasks/result-video',
            },
          ],
        },
      }),
    ).toBe('https://cdn.example.com/tasks/result-video')
  })

  it('falls back to likely video url fields without returning the input image', () => {
    expect(
      readNewApiVideoUrl({
        status: 'success',
        input_image_url: 'https://cdn.example.com/input.png',
        data: {
          task: {
            files: {
              video_urls: ['https://cdn.example.com/tasks/generated.m3u8'],
            },
          },
        },
      }),
    ).toBe('https://cdn.example.com/tasks/generated.m3u8')
  })

  it('does not treat the source image as an output video', () => {
    expect(
      readNewApiVideoUrl({
        status: 'completed',
        data: {
          input_image_url: 'https://cdn.example.com/input.png',
          prompt: 'make it move',
        },
      }),
    ).toBe('')
  })
})
