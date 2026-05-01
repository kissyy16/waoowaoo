import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveModelSelectionMock = vi.hoisted(() =>
  vi.fn(async () => ({
    provider: 'openai-compatible:oa-1',
    modelId: 'gpt-image-1',
    modelKey: 'openai-compatible:oa-1::gpt-image-1',
    mediaType: 'image',
    compatMediaTemplate: undefined,
  })),
)
const getProviderConfigMock = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 'openai-compatible:oa-1',
    name: 'OpenAI Compat',
    apiKey: 'oa-key',
    gatewayRoute: 'openai-compat' as const,
  })),
)
const resolveModelGatewayRouteMock = vi.hoisted(() => vi.fn(() => 'openai-compat'))
const generateImageViaOpenAICompatMock = vi.hoisted(() => vi.fn(async () => ({ success: true, imageUrl: 'image' })))
const generateVideoViaOpenAICompatMock = vi.hoisted(() => vi.fn(async () => ({ success: true, videoUrl: 'video' })))
const generateImageViaOpenAICompatTemplateMock = vi.hoisted(() => vi.fn(async () => ({ success: true, imageUrl: 'image' })))
const generateVideoViaOpenAICompatTemplateMock = vi.hoisted(() => vi.fn(async () => ({ success: true, videoUrl: 'video' })))
const generateVideoViaNewApiCompatMock = vi.hoisted(() => vi.fn(async () => ({ success: true, async: true, externalId: 'NEWAPI:VIDEO:provider:task-1' })))

vi.mock('@/lib/api-config', () => ({
  resolveModelSelection: resolveModelSelectionMock,
  getProviderConfig: getProviderConfigMock,
  getProviderKey: (providerId: string) => providerId.split(':')[0] || providerId,
}))

vi.mock('@/lib/model-gateway', () => ({
  resolveModelGatewayRoute: resolveModelGatewayRouteMock,
  generateImageViaOpenAICompat: generateImageViaOpenAICompatMock,
  generateVideoViaOpenAICompat: generateVideoViaOpenAICompatMock,
  generateImageViaOpenAICompatTemplate: generateImageViaOpenAICompatTemplateMock,
  generateVideoViaOpenAICompatTemplate: generateVideoViaOpenAICompatTemplateMock,
  generateVideoViaNewApiCompat: generateVideoViaNewApiCompatMock,
  isNewApiSeedanceVideoModel: (modelId: string) => modelId === 'doubao-seedance-2.0',
  isOpenAISoraStyleVideoTemplate: () => false,
}))

vi.mock('@/lib/generators/factory', () => ({
  createImageGenerator: vi.fn(() => ({ generate: vi.fn() })),
  createVideoGenerator: vi.fn(() => ({ generate: vi.fn() })),
  createAudioGenerator: vi.fn(() => ({ generate: vi.fn() })),
}))

vi.mock('@/lib/providers/bailian', () => ({
  generateBailianImage: vi.fn(),
  generateBailianVideo: vi.fn(),
  generateBailianAudio: vi.fn(),
}))

vi.mock('@/lib/providers/siliconflow', () => ({
  generateSiliconFlowImage: vi.fn(),
  generateSiliconFlowVideo: vi.fn(),
  generateSiliconFlowAudio: vi.fn(),
}))

import { generateImage, generateVideo } from '@/lib/generator-api'

describe('generator-api requires compat media template for openai-compatible media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveModelGatewayRouteMock.mockReturnValue('openai-compat')
    getProviderConfigMock.mockResolvedValue({
      id: 'openai-compatible:oa-1',
      name: 'OpenAI Compat',
      apiKey: 'oa-key',
      gatewayRoute: 'openai-compat',
    })
  })

  it('throws for image model without compatMediaTemplate', async () => {
    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'gpt-image-1',
      modelKey: 'openai-compatible:oa-1::gpt-image-1',
      mediaType: 'image',
      compatMediaTemplate: undefined,
    })

    await expect(
      generateImage('user-1', 'openai-compatible:oa-1::gpt-image-1', 'draw cat'),
    ).rejects.toThrow('MODEL_COMPAT_MEDIA_TEMPLATE_REQUIRED')

    expect(generateImageViaOpenAICompatMock).not.toHaveBeenCalled()
    expect(generateImageViaOpenAICompatTemplateMock).not.toHaveBeenCalled()
  })

  it('throws for video model without compatMediaTemplate', async () => {
    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'veo3.1',
      modelKey: 'openai-compatible:oa-1::veo3.1',
      mediaType: 'video',
      compatMediaTemplate: undefined,
    })

    await expect(
      generateVideo('user-1', 'openai-compatible:oa-1::veo3.1', 'https://example.com/a.png', { prompt: 'animate' }),
    ).rejects.toThrow('MODEL_COMPAT_MEDIA_TEMPLATE_REQUIRED')

    expect(generateVideoViaOpenAICompatMock).not.toHaveBeenCalled()
    expect(generateVideoViaOpenAICompatTemplateMock).not.toHaveBeenCalled()
  })

  it('routes openai-compatible New API Seedance video without a custom template', async () => {
    resolveModelSelectionMock.mockResolvedValueOnce({
      provider: 'openai-compatible:oa-1',
      modelId: 'doubao-seedance-2.0',
      modelKey: 'openai-compatible:oa-1::doubao-seedance-2.0',
      mediaType: 'video',
      compatMediaTemplate: undefined,
    })

    const result = await generateVideo(
      'user-1',
      'openai-compatible:oa-1::doubao-seedance-2.0',
      'https://example.com/a.png',
      { prompt: 'animate' },
    )

    expect(result.success).toBe(true)
    expect(generateVideoViaNewApiCompatMock).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'openai-compatible:oa-1',
      modelId: 'doubao-seedance-2.0',
      imageUrl: 'https://example.com/a.png',
      prompt: 'animate',
    }))
    expect(generateVideoViaOpenAICompatMock).not.toHaveBeenCalled()
    expect(generateVideoViaOpenAICompatTemplateMock).not.toHaveBeenCalled()
  })
})
