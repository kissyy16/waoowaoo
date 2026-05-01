import type { GenerateResult } from '@/lib/generators/base'
import type { OpenAICompatMediaTemplate } from '@/lib/openai-compat-media-template'
import {
  normalizeResponseJson,
  readJsonPath,
  resolveTemplateEndpointUrl,
} from '@/lib/openai-compat-template-runtime'
import type { OpenAICompatVideoRequest } from '../types'
import { resolveOpenAICompatClientConfig } from './common'

type VideoDimensions = {
  width: number
  height: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function encodeProviderToken(providerId: string): string {
  return `b64_${Buffer.from(providerId, 'utf8').toString('base64url')}`
}

function readPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function readPositiveInteger(value: unknown): number | undefined {
  const parsed = readPositiveNumber(value)
  if (parsed === undefined) return undefined
  return Math.round(parsed)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function parseSize(value: unknown): VideoDimensions | undefined {
  const raw = readString(value)
  if (!raw) return undefined
  const match = raw.match(/^(\d{2,5})x(\d{2,5})$/i)
  if (!match) return undefined
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return undefined
  }
  return { width, height }
}

function parseAspectRatio(value: unknown): { widthRatio: number; heightRatio: number } | undefined {
  const raw = readString(value)
  if (!raw) return undefined
  const match = raw.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return undefined
  const widthRatio = Number(match[1])
  const heightRatio = Number(match[2])
  if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    return undefined
  }
  return { widthRatio, heightRatio }
}

function resolveShortSidePixels(resolution: unknown): number | undefined {
  const raw = readString(resolution)?.toLowerCase()
  if (!raw) return undefined
  const match = raw.match(/^(\d{3,4})p$/)
  if (!match) return undefined
  const pixels = Number(match[1])
  return Number.isFinite(pixels) && pixels > 0 ? pixels : undefined
}

function resolveDimensions(options: Record<string, unknown>): VideoDimensions | undefined {
  const explicitSize = parseSize(options.size)
  if (explicitSize) return explicitSize

  const shortSide = resolveShortSidePixels(options.resolution)
  const ratio = parseAspectRatio(options.aspectRatio || options.aspect_ratio)
  if (!shortSide || !ratio) return undefined

  const landscapeOrSquare = ratio.widthRatio >= ratio.heightRatio
  if (landscapeOrSquare) {
    const width = Math.round(shortSide * (ratio.widthRatio / ratio.heightRatio))
    return { width, height: shortSide }
  }

  const height = Math.round(shortSide * (ratio.heightRatio / ratio.widthRatio))
  return { width: shortSide, height }
}

function buildMetadata(options: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  const aspectRatio = readString(options.aspectRatio || options.aspect_ratio)
  const resolution = readString(options.resolution)
  const lastFrameImageUrl = readString(options.lastFrameImageUrl)

  if (aspectRatio) metadata.aspect_ratio = aspectRatio
  if (resolution) metadata.resolution = resolution
  if (typeof options.generateAudio === 'boolean') metadata.generate_audio = options.generateAudio
  if (lastFrameImageUrl) metadata.image_tail = lastFrameImageUrl

  return metadata
}

function readFirstString(payload: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = readJsonPath(payload, path)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function extractNewApiError(payload: unknown, status: number): string {
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

export function isNewApiSeedanceVideoModel(modelId: string | undefined | null): boolean {
  const normalized = modelId?.trim().toLowerCase()
  if (!normalized) return false
  return /(^|[/])doubao[-_]?seedance[-_]?2(?:[._-]0)?(?:$|[-_./])/.test(normalized)
}

export function isOpenAISoraStyleVideoTemplate(template: OpenAICompatMediaTemplate | undefined): boolean {
  if (!template || template.mediaType !== 'video') return false
  const path = template.create.path.trim().toLowerCase().replace(/\/+$/, '')
  const body = template.create.bodyTemplate
  const keys = isRecord(body) ? new Set(Object.keys(body)) : new Set<string>()

  return (
    path.endsWith('/videos')
    || keys.has('input_reference')
    || keys.has('seconds')
  )
}

export async function generateVideoViaNewApiCompat(
  request: OpenAICompatVideoRequest,
): Promise<GenerateResult> {
  const config = await resolveOpenAICompatClientConfig(request.userId, request.providerId)
  const model = readString(request.modelId || request.options?.modelId)
  if (!model) {
    throw new Error('NEWAPI_VIDEO_MODEL_REQUIRED')
  }

  const prompt = request.prompt.trim()
  if (!prompt) {
    throw new Error('NEWAPI_VIDEO_PROMPT_REQUIRED')
  }

  const options = request.options || {}
  const body: Record<string, unknown> = {
    model,
    prompt,
    image: request.imageUrl,
  }

  const duration = readPositiveNumber(options.duration)
  const fps = readPositiveInteger(options.fps)
  const seed = readPositiveInteger(options.seed)
  const dimensions = resolveDimensions(options)
  const metadata = buildMetadata(options)

  if (duration !== undefined) body.duration = duration
  if (fps !== undefined) body.fps = fps
  if (seed !== undefined) body.seed = seed
  if (dimensions) {
    body.width = dimensions.width
    body.height = dimensions.height
  }
  if (Object.keys(metadata).length > 0) {
    body.metadata = metadata
  }

  const endpointUrl = resolveTemplateEndpointUrl(config.baseUrl, '/video/generations')
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
    throw new Error(`NEWAPI_VIDEO_CREATE_FAILED: ${extractNewApiError(payload, response.status)}`)
  }

  const taskId = readFirstString(payload, ['$.task_id', '$.id'])
  if (!taskId) {
    throw new Error('NEWAPI_VIDEO_CREATE_INVALID_RESPONSE: missing task id')
  }

  const providerToken = encodeProviderToken(config.providerId)
  return {
    success: true,
    async: true,
    requestId: taskId,
    externalId: `NEWAPI:VIDEO:${providerToken}:${taskId}`,
  }
}
