import type { GenerateResult } from '@/lib/generators/base'
import {
  normalizeResponseJson,
  readJsonPath,
  resolveTemplateEndpointUrl,
} from '@/lib/openai-compat-template-runtime'
import type { OpenAICompatVideoRequest } from '../types'
import { resolveOpenAICompatClientConfig } from './common'

function encodeProviderToken(providerId: string): string {
  return `b64_${Buffer.from(providerId, 'utf8').toString('base64url')}`
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
}

function readFirstString(payload: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = readJsonPath(payload, path)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function extractXaiVideoError(payload: unknown, status: number): string {
  const message = readFirstString(payload, [
    '$.error.message',
    '$.message',
    '$.message_zh',
    '$.error',
  ])
  if (message) return message
  if (typeof payload === 'string' && payload.trim()) return payload.trim().slice(0, 300)
  if (payload && typeof payload === 'object') {
    try {
      return JSON.stringify(payload).slice(0, 300)
    } catch {
      return `HTTP ${status}`
    }
  }
  return `HTTP ${status}`
}

export function isXaiGrokVideoModel(modelId: string | undefined | null): boolean {
  const normalized = modelId?.trim().toLowerCase()
  if (!normalized) return false
  return /(^|[/])grok[-_](?:imagine|image)[-_]video(?:$|[-_./])/.test(normalized)
}

export async function generateVideoViaXAICompat(
  request: OpenAICompatVideoRequest,
): Promise<GenerateResult> {
  const config = await resolveOpenAICompatClientConfig(request.userId, request.providerId)
  const model = readString(request.modelId || request.options?.modelId)
  if (!model) {
    throw new Error('XAI_VIDEO_MODEL_REQUIRED')
  }

  const prompt = request.prompt.trim()
  if (!prompt) {
    throw new Error('XAI_VIDEO_PROMPT_REQUIRED')
  }

  const options = request.options || {}
  const imageUrl = readString(request.imageUrl)
  const duration = readPositiveInteger(options.duration)
  const aspectRatio = readString(options.aspectRatio || options.aspect_ratio)
  const resolution = readString(options.resolution)

  const body: Record<string, unknown> = {
    model,
    prompt,
  }

  if (imageUrl) body.image = { url: imageUrl }
  if (duration !== undefined) body.duration = duration
  if (aspectRatio) body.aspect_ratio = aspectRatio
  if (resolution) body.resolution = resolution

  const endpointUrl = resolveTemplateEndpointUrl(config.baseUrl, '/videos/generations')
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const rawText = await response.text().catch(() => '')
  const payload = normalizeResponseJson(rawText)

  if (!response.ok) {
    throw new Error(`XAI_VIDEO_CREATE_FAILED: ${extractXaiVideoError(payload, response.status)}`)
  }

  const requestId = readFirstString(payload, ['$.request_id', '$.id'])
  if (!requestId) {
    throw new Error('XAI_VIDEO_CREATE_INVALID_RESPONSE: missing request id')
  }

  const providerToken = encodeProviderToken(config.providerId)
  return {
    success: true,
    async: true,
    requestId,
    externalId: `XAI:VIDEO:${providerToken}:${requestId}`,
  }
}
