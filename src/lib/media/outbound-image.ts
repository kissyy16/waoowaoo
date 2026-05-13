import path from 'node:path'
import { createScopedLogger } from '@/lib/logging/core'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'

type StorageHelpers = Pick<typeof import('@/lib/storage'), 'getSignedUrl' | 'toFetchableUrl'>

type InputIssueReason =
  | 'next_image_unwrapped'
  | 'empty_value_skipped'
  | 'relative_path_rejected'
  | 'non_string_skipped'

export type OutboundImageInputIssue = {
  index: number
  input: unknown
  normalized?: string
  reason: InputIssueReason
}

export type OutboundImageNormalizeStage =
  | 'normalize_original'
  | 'normalize_base64'
  | 'normalize_reference'

export type OutboundImageNormalizeErrorCode =
  | 'OUTBOUND_IMAGE_EMPTY_INPUT'
  | 'OUTBOUND_IMAGE_UNSUPPORTED_INPUT'
  | 'OUTBOUND_IMAGE_MEDIA_ROUTE_UNRESOLVED'
  | 'OUTBOUND_IMAGE_FETCH_FAILED'
  | 'OUTBOUND_IMAGE_FETCH_EXCEPTION'
  | 'OUTBOUND_IMAGE_REFERENCE_ALL_FAILED'

export class OutboundImageNormalizeError extends Error {
  readonly code: OutboundImageNormalizeErrorCode
  readonly stage: OutboundImageNormalizeStage
  readonly input: string

  constructor(params: {
    code: OutboundImageNormalizeErrorCode
    stage: OutboundImageNormalizeStage
    input: string
    message: string
  }) {
    super(params.message)
    this.name = 'OutboundImageNormalizeError'
    this.code = params.code
    this.stage = params.stage
    this.input = params.input
  }
}

export type OutboundImageNormalizationIssue = {
  index: number
  input: string
  code: OutboundImageNormalizeErrorCode | 'OUTBOUND_IMAGE_UNKNOWN'
  stage: OutboundImageNormalizeStage
  message: string
}

export type GenerationImageCompressionOptions = {
  maxEdge?: number
  targetBytes?: number
  quality?: number
  minQuality?: number
}

export type NormalizeToBase64ForGenerationOptions = {
  compressImages?: boolean | GenerationImageCompressionOptions
}

const logger = createScopedLogger({
  module: 'media.outbound-image',
})

const NEXT_IMAGE_PATH = '/_next/image'
const MAX_NEXT_IMAGE_UNWRAP_DEPTH = 6
const SIGNED_URL_TTL_SECONDS = 3600
const STORAGE_KEY_PREFIXES = ['images/', 'video/', 'voice/'] as const
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'
const DEFAULT_REFERENCE_IMAGE_MAX_EDGE = 1536
const DEFAULT_REFERENCE_IMAGE_TARGET_BYTES = 2 * 1024 * 1024
const DEFAULT_REFERENCE_IMAGE_QUALITY = 85
const DEFAULT_REFERENCE_IMAGE_MIN_QUALITY = 65

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
}

let storageHelpersPromise: Promise<StorageHelpers> | null = null

async function getStorageHelpers(): Promise<StorageHelpers> {
  if (!storageHelpersPromise) {
    storageHelpersPromise = import('@/lib/storage').then((mod) => ({
      getSignedUrl: mod.getSignedUrl,
      toFetchableUrl: mod.toFetchableUrl,
    }))
  }
  return await storageHelpersPromise
}

function normalizeInput(input: string): string {
  const value = typeof input === 'string' ? input.trim() : ''
  if (!value) {
    throw new OutboundImageNormalizeError({
      code: 'OUTBOUND_IMAGE_EMPTY_INPUT',
      stage: 'normalize_original',
      input: String(input ?? ''),
      message: 'outbound image input is empty',
    })
  }
  return value
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

function parseDataUrl(value: string): { mimeType: string; base64: string } | null {
  const marker = ';base64,'
  const markerIndex = value.indexOf(marker)
  if (!value.startsWith('data:') || markerIndex === -1) return null
  const mimeType = value.slice(5, markerIndex).split(';')[0]?.trim().toLowerCase() || ''
  const base64 = value.slice(markerIndex + marker.length)
  if (!mimeType || !base64) return null
  return { mimeType, base64 }
}

function isCompressibleImageMime(mimeType: string): boolean {
  return (
    mimeType === 'image/png'
    || mimeType === 'image/jpeg'
    || mimeType === 'image/jpg'
    || mimeType === 'image/webp'
  )
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function resolveCompressionOptions(
  options?: GenerationImageCompressionOptions,
): Required<GenerationImageCompressionOptions> {
  const maxEdge = normalizePositiveInteger(
    options?.maxEdge ?? process.env.GENERATION_REFERENCE_IMAGE_MAX_EDGE,
    DEFAULT_REFERENCE_IMAGE_MAX_EDGE,
  )
  const targetBytes = normalizePositiveInteger(
    options?.targetBytes ?? process.env.GENERATION_REFERENCE_IMAGE_TARGET_BYTES,
    DEFAULT_REFERENCE_IMAGE_TARGET_BYTES,
  )
  const quality = normalizePositiveInteger(options?.quality, DEFAULT_REFERENCE_IMAGE_QUALITY)
  const minQuality = normalizePositiveInteger(options?.minQuality, DEFAULT_REFERENCE_IMAGE_MIN_QUALITY)

  return {
    maxEdge,
    targetBytes,
    quality: Math.max(1, Math.min(100, quality)),
    minQuality: Math.max(1, Math.min(100, Math.min(minQuality, quality))),
  }
}

function readNormalizeCompressionOptions(
  options?: NormalizeToBase64ForGenerationOptions,
): GenerationImageCompressionOptions | null {
  if (options?.compressImages === true) return {}
  if (options?.compressImages && typeof options.compressImages === 'object') {
    return options.compressImages
  }
  return null
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function isAbsoluteOrRootPath(value: string): boolean {
  return isHttpUrl(value) || value.startsWith('/')
}

function isStorageKey(value: string): boolean {
  return STORAGE_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))
}

function isNextImagePath(pathname: string): boolean {
  return pathname === NEXT_IMAGE_PATH || pathname.endsWith(NEXT_IMAGE_PATH)
}

function decodeRepeatedly(raw: string): string {
  let value = raw
  for (let i = 0; i < MAX_NEXT_IMAGE_UNWRAP_DEPTH; i += 1) {
    try {
      const decoded = decodeURIComponent(value)
      if (decoded === value) {
        break
      }
      value = decoded
    } catch {
      break
    }
  }
  return value
}

function normalizeUnwrappedTarget(raw: string): string {
  const value = decodeRepeatedly(raw).trim()
  if (!value) return value
  if (isAbsoluteOrRootPath(value) || isDataUrl(value) || isStorageKey(value)) return value
  if (value.startsWith('m/')) return `/${value}`
  if (value.startsWith('api/')) return `/${value}`
  return value
}

function toUrlMaybe(value: string): URL | null {
  try {
    if (isHttpUrl(value)) return new URL(value)
    if (value.startsWith('/')) return new URL(value, 'http://localhost')
  } catch {
    return null
  }
  return null
}

function detectMimeFromBuffer(buffer: Uint8Array): string | null {
  if (buffer.length >= 8) {
    const isPng =
      buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a
    if (isPng) return 'image/png'
  }

  if (buffer.length >= 3) {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (isJpeg) return 'image/jpeg'
  }

  if (buffer.length >= 6) {
    const isGif87a =
      buffer[0] === 0x47
      && buffer[1] === 0x49
      && buffer[2] === 0x46
      && buffer[3] === 0x38
      && buffer[4] === 0x37
      && buffer[5] === 0x61
    const isGif89a =
      buffer[0] === 0x47
      && buffer[1] === 0x49
      && buffer[2] === 0x46
      && buffer[3] === 0x38
      && buffer[4] === 0x39
      && buffer[5] === 0x61
    if (isGif87a || isGif89a) return 'image/gif'
  }

  if (buffer.length >= 12) {
    const isWebp =
      buffer[0] === 0x52
      && buffer[1] === 0x49
      && buffer[2] === 0x46
      && buffer[3] === 0x46
      && buffer[8] === 0x57
      && buffer[9] === 0x45
      && buffer[10] === 0x42
      && buffer[11] === 0x50
    if (isWebp) return 'image/webp'
  }

  if (buffer.length >= 12) {
    const isWav =
      buffer[0] === 0x52
      && buffer[1] === 0x49
      && buffer[2] === 0x46
      && buffer[3] === 0x46
      && buffer[8] === 0x57
      && buffer[9] === 0x41
      && buffer[10] === 0x56
      && buffer[11] === 0x45
    if (isWav) return 'audio/wav'
  }

  if (buffer.length >= 4) {
    const isOgg =
      buffer[0] === 0x4f
      && buffer[1] === 0x67
      && buffer[2] === 0x67
      && buffer[3] === 0x53
    if (isOgg) return 'audio/ogg'
  }

  if (buffer.length >= 3) {
    const isMp3WithId3 =
      buffer[0] === 0x49
      && buffer[1] === 0x44
      && buffer[2] === 0x33
    const isMp3FrameSync =
      buffer[0] === 0xff
      && (buffer[1] & 0xe0) === 0xe0
    if (isMp3WithId3 || isMp3FrameSync) return 'audio/mpeg'
  }

  if (buffer.length >= 12) {
    const isWebm =
      buffer[0] === 0x1a
      && buffer[1] === 0x45
      && buffer[2] === 0xdf
      && buffer[3] === 0xa3
    if (isWebm) return 'video/webm'
  }

  if (buffer.length >= 8) {
    const isMp4 =
      buffer[4] === 0x66
      && buffer[5] === 0x74
      && buffer[6] === 0x79
      && buffer[7] === 0x70
    if (isMp4) return 'video/mp4'
  }

  return null
}

function guessContentType(input: string, contentTypeHeader: string | null, buffer: Uint8Array): string {
  const sniffedType = detectMimeFromBuffer(buffer)
  if (sniffedType) return sniffedType
  const headerType = contentTypeHeader?.split(';')[0]?.trim()
  if (headerType && headerType !== DEFAULT_CONTENT_TYPE) return headerType
  const parsed = toUrlMaybe(input)
  const pathname = parsed?.pathname ?? input
  const ext = path.extname(pathname).toLowerCase()
  return MIME_BY_EXT[ext] || DEFAULT_CONTENT_TYPE
}

export async function compressImageDataUrlForGeneration(
  dataUrl: string,
  options?: GenerationImageCompressionOptions,
): Promise<string> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !isCompressibleImageMime(parsed.mimeType)) return dataUrl

  let inputBuffer: Buffer
  try {
    inputBuffer = Buffer.from(parsed.base64, 'base64')
  } catch {
    return dataUrl
  }
  if (inputBuffer.length === 0) return dataUrl

  const resolved = resolveCompressionOptions(options)
  const sharp = (await import('sharp')).default

  let metadata: import('sharp').Metadata
  try {
    metadata = await sharp(inputBuffer, { animated: false }).metadata()
  } catch {
    return dataUrl
  }

  const width = metadata.width || 0
  const height = metadata.height || 0
  if (width <= 0 || height <= 0) return dataUrl

  const shouldResize = Math.max(width, height) > resolved.maxEdge
  if (!shouldResize && inputBuffer.length <= resolved.targetBytes) {
    return dataUrl
  }

  const qualities: number[] = []
  for (let quality = resolved.quality; quality >= resolved.minQuality; quality -= 10) {
    qualities.push(quality)
  }
  if (!qualities.includes(resolved.minQuality)) qualities.push(resolved.minQuality)

  let bestBuffer: Buffer | null = null
  let bestQuality = qualities[0] || resolved.quality
  for (const quality of qualities) {
    let pipeline = sharp(inputBuffer, { animated: false }).rotate()
    if (shouldResize) {
      pipeline = pipeline.resize({
        width: resolved.maxEdge,
        height: resolved.maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } })

    const outputBuffer = await pipeline
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()

    bestBuffer = outputBuffer
    bestQuality = quality
    if (outputBuffer.length <= resolved.targetBytes) break
  }

  if (!bestBuffer) return dataUrl
  if (bestBuffer.length >= inputBuffer.length && inputBuffer.length <= resolved.targetBytes) {
    return dataUrl
  }

  let outputMetadata: import('sharp').Metadata | null = null
  try {
    outputMetadata = await sharp(bestBuffer).metadata()
  } catch {
    outputMetadata = null
  }

  logger.info({
    message: 'reference image compressed for generation',
    details: {
      originalBytes: inputBuffer.length,
      outputBytes: bestBuffer.length,
      originalWidth: width,
      originalHeight: height,
      outputWidth: outputMetadata?.width ?? null,
      outputHeight: outputMetadata?.height ?? null,
      outputMimeType: 'image/jpeg',
      quality: bestQuality,
      maxEdge: resolved.maxEdge,
      targetBytes: resolved.targetBytes,
    },
  })

  return `data:image/jpeg;base64,${bestBuffer.toString('base64')}`
}

async function signStorageKey(storageKey: string): Promise<string> {
  const { getSignedUrl, toFetchableUrl } = await getStorageHelpers()
  return toFetchableUrl(getSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS))
}

async function toFetchableAbsoluteUrl(value: string): Promise<string> {
  const { toFetchableUrl } = await getStorageHelpers()
  return toFetchableUrl(value)
}

function unwrapNextImageInternal(input: string): string {
  let current = input.trim()
  for (let i = 0; i < MAX_NEXT_IMAGE_UNWRAP_DEPTH; i += 1) {
    const parsed = toUrlMaybe(current)
    if (!parsed || !isNextImagePath(parsed.pathname)) {
      break
    }
    const wrapped = parsed.searchParams.get('url')
    if (!wrapped) {
      break
    }
    const unwrapped = normalizeUnwrappedTarget(wrapped)
    if (!unwrapped || unwrapped === current) {
      break
    }
    current = unwrapped
  }
  return current
}

async function normalizeMediaRouteUrl(input: string): Promise<string | null> {
  const parsed = toUrlMaybe(input)
  if (!parsed || !parsed.pathname.startsWith('/m/')) {
    return null
  }

  const mediaPath = parsed.pathname
  const storageKey = await resolveStorageKeyFromMediaValue(mediaPath)
  if (!storageKey) {
    throw new OutboundImageNormalizeError({
      code: 'OUTBOUND_IMAGE_MEDIA_ROUTE_UNRESOLVED',
      stage: 'normalize_original',
      input,
      message: `failed to resolve /m route to storage key: ${mediaPath}`,
    })
  }

  return await signStorageKey(storageKey)
}

export function unwrapNextImageDisplayUrl(input: string): string {
  return unwrapNextImageInternal(input)
}

export async function normalizeToOriginalMediaUrl(input: string): Promise<string> {
  const normalizedInput = normalizeInput(input)
  if (isDataUrl(normalizedInput)) {
    return normalizedInput
  }

  const unwrappedInput = unwrapNextImageInternal(normalizedInput)
  if (unwrappedInput !== normalizedInput) {
    return await normalizeToOriginalMediaUrl(unwrappedInput)
  }

  if (isStorageKey(unwrappedInput)) {
    return await signStorageKey(unwrappedInput)
  }

  const mediaRouteUrl = await normalizeMediaRouteUrl(unwrappedInput)
  if (mediaRouteUrl) {
    return mediaRouteUrl
  }

  if (unwrappedInput.startsWith('/')) {
    if (unwrappedInput.startsWith('/api/')) {
      const apiPath = unwrappedInput
      return await toFetchableAbsoluteUrl(apiPath)
    }
    const rootStorageKey = unwrappedInput.slice(1)
    if (isStorageKey(rootStorageKey)) {
      return await signStorageKey(rootStorageKey)
    }
    throw new OutboundImageNormalizeError({
      code: 'OUTBOUND_IMAGE_UNSUPPORTED_INPUT',
      stage: 'normalize_original',
      input: unwrappedInput,
      message: `unsupported root-relative outbound image input: ${unwrappedInput}`,
    })
  }

  if (isHttpUrl(unwrappedInput)) {
    return unwrappedInput
  }

  const storageKey = await resolveStorageKeyFromMediaValue(unwrappedInput)
  if (storageKey) {
    return await signStorageKey(storageKey)
  }

  throw new OutboundImageNormalizeError({
    code: 'OUTBOUND_IMAGE_UNSUPPORTED_INPUT',
    stage: 'normalize_original',
    input: unwrappedInput,
    message: `unsupported outbound image input: ${unwrappedInput}`,
  })
}

export async function normalizeToBase64ForGeneration(
  input: string,
  options?: NormalizeToBase64ForGenerationOptions,
): Promise<string> {
  const normalizedUrl = await normalizeToOriginalMediaUrl(input)
  if (isDataUrl(normalizedUrl)) {
    const compressionOptions = readNormalizeCompressionOptions(options)
    return compressionOptions
      ? await compressImageDataUrlForGeneration(normalizedUrl, compressionOptions)
      : normalizedUrl
  }

  const fetchUrl = await toFetchableAbsoluteUrl(normalizedUrl)
  let response: Response
  try {
    response = await fetch(fetchUrl)
  } catch {
    throw new OutboundImageNormalizeError({
      code: 'OUTBOUND_IMAGE_FETCH_EXCEPTION',
      stage: 'normalize_base64',
      input: normalizedUrl,
      message: `normalizeToBase64ForGeneration fetch exception: ${fetchUrl}`,
    })
  }

  if (!response.ok) {
    throw new OutboundImageNormalizeError({
      code: 'OUTBOUND_IMAGE_FETCH_FAILED',
      stage: 'normalize_base64',
      input: normalizedUrl,
      message: `normalizeToBase64ForGeneration fetch failed (${response.status}): ${fetchUrl}`,
    })
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const mimeType = guessContentType(normalizedUrl, response.headers.get('content-type'), buffer)
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
  const compressionOptions = readNormalizeCompressionOptions(options)
  return compressionOptions
    ? await compressImageDataUrlForGeneration(dataUrl, compressionOptions)
    : dataUrl
}

function toNormalizationIssue(
  error: unknown,
  input: string,
  index: number,
): OutboundImageNormalizationIssue {
  if (error instanceof OutboundImageNormalizeError) {
    return {
      index,
      input,
      code: error.code,
      stage: error.stage,
      message: error.message,
    }
  }
  return {
    index,
    input,
    code: 'OUTBOUND_IMAGE_UNKNOWN',
    stage: 'normalize_reference',
    message: error instanceof Error ? error.message : String(error),
  }
}

export async function normalizeReferenceImagesForGeneration(
  inputs: string[],
  options: {
    onIssue?: (issue: OutboundImageNormalizationIssue) => void
    context?: Record<string, unknown>
  } = {},
): Promise<string[]> {
  const seen = new Set<string>()
  const normalized: string[] = []
  let candidateCount = 0

  for (let index = 0; index < inputs.length; index += 1) {
    const item = inputs[index]
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    candidateCount += 1

    try {
      normalized.push(await normalizeToBase64ForGeneration(trimmed, { compressImages: true }))
    } catch (error) {
      const issue = toNormalizationIssue(error, trimmed, index)
      options.onIssue?.(issue)
      logger.warn({
        message: 'reference image normalize failed',
        details: {
          ...issue,
          context: options.context || null,
        },
      })
    }
  }

  if (candidateCount > 0 && normalized.length === 0) {
    throw new OutboundImageNormalizeError({
      code: 'OUTBOUND_IMAGE_REFERENCE_ALL_FAILED',
      stage: 'normalize_reference',
      input: `candidates=${candidateCount}`,
      message: 'all reference images failed to normalize',
    })
  }

  return normalized
}

export function sanitizeImageInputsForTaskPayload(inputs: unknown[]): {
  normalized: string[]
  issues: OutboundImageInputIssue[]
} {
  const issues: OutboundImageInputIssue[] = []
  const normalized: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < inputs.length; i += 1) {
    const raw = inputs[i]
    if (typeof raw !== 'string') {
      issues.push({ index: i, input: raw, reason: 'non_string_skipped' })
      continue
    }

    const trimmed = raw.trim()
    if (!trimmed) {
      issues.push({ index: i, input: raw, reason: 'empty_value_skipped' })
      continue
    }

    const unwrapped = unwrapNextImageInternal(trimmed)
    if (unwrapped !== trimmed) {
      issues.push({ index: i, input: raw, normalized: unwrapped, reason: 'next_image_unwrapped' })
    }

    if (unwrapped.startsWith('/') && !unwrapped.startsWith('/m/') && !unwrapped.startsWith('/api/')) {
      issues.push({ index: i, input: raw, normalized: unwrapped, reason: 'relative_path_rejected' })
      continue
    }

    if (seen.has(unwrapped)) continue
    seen.add(unwrapped)
    normalized.push(unwrapped)
  }

  return { normalized, issues }
}
