import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { bundle } from '@remotion/bundler'
import { getVideoMetadata, renderMedia, selectComposition, type VideoMetadata } from '@remotion/renderer'
import type { VideoEditorProject } from '@/features/video-editor/types/editor.types'
import type { BgmClip, VideoClip } from '@/features/video-editor/types/editor.types'
import { extractStorageKey, generateUniqueKey, getSignedUrl, getStorageType, toFetchableUrl, uploadObject } from '@/lib/storage'

const VIDEO_COMPOSITION_ID = 'VideoComposition'
const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads'
const RENDER_TIMEOUT_MS = 120_000

type ClipWithRenderMetadata = {
  clip: VideoClip
  src: string
  metadata: VideoMetadata | null
}

function toRenderSource(value: string): string {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('file://')
  ) {
    return value
  }
  if (value.startsWith('/m/')) {
    return toFetchableUrl(value)
  }

  const storageKey = extractStorageKey(value) || value
  return toFetchableUrl(getSignedUrl(storageKey, 7200))
}

function toLocalStoragePath(storageKey: string): string {
  return path.join(process.cwd(), LOCAL_UPLOAD_DIR, storageKey.replace(/^\/+/, ''))
}

function extractLocalStorageKey(value: string): string | null {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('file://') ||
    value.startsWith('/m/')
  ) {
    return null
  }
  return extractStorageKey(value)
}

async function readVideoMetadata(value: string, renderSrc: string): Promise<VideoMetadata | null> {
  const storageKey = extractLocalStorageKey(value)
  const metadataSrc = storageKey && getStorageType() === 'local'
    ? toLocalStoragePath(storageKey)
    : renderSrc

  try {
    return await getVideoMetadata(metadataSrc, { logLevel: 'warn' })
  } catch {
    return null
  }
}

function sanitizeFps(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 1 || value > 120) return null
  return value
}

function resolveRenderFps(projectFps: number, clips: ClipWithRenderMetadata[]): number {
  const fpsValues = clips
    .map((item) => sanitizeFps(item.metadata?.fps))
    .filter((value): value is number => value !== null)
  if (fpsValues.length !== clips.length || fpsValues.length === 0) return projectFps

  const [first] = fpsValues
  const allSameFps = fpsValues.every((value) => Math.abs(value - first) < 0.2)
  return allSameFps ? first : projectFps
}

function frameCountFromSeconds(seconds: number, fps: number): number {
  return Math.max(1, Math.floor(seconds * fps))
}

function scaleFrames(frames: number | null | undefined, fromFps: number, toFps: number): number {
  if (typeof frames !== 'number' || !Number.isFinite(frames)) return 0
  return Math.max(0, Math.round((frames / fromFps) * toFps))
}

function normalizeClipForRender(
  item: ClipWithRenderMetadata,
  sourceFps: number,
  renderFps: number,
): VideoClip {
  const requestedDurationFrames = Math.max(1, scaleFrames(item.clip.durationInFrames, sourceFps, renderFps))
  const mediaDurationSeconds = typeof item.metadata?.durationInSeconds === 'number' && Number.isFinite(item.metadata.durationInSeconds)
    ? item.metadata.durationInSeconds
    : null
  const sourceDurationInFrames = mediaDurationSeconds
    ? frameCountFromSeconds(mediaDurationSeconds, renderFps)
    : null

  return {
    ...item.clip,
    src: item.src,
    durationInFrames: requestedDurationFrames,
    sourceDurationInFrames: sourceDurationInFrames || undefined,
    trim: item.clip.trim
      ? {
          from: scaleFrames(item.clip.trim.from, sourceFps, renderFps),
          to: scaleFrames(item.clip.trim.to, sourceFps, renderFps),
        }
      : item.clip.trim,
    transition: item.clip.transition
      ? {
          ...item.clip.transition,
          durationInFrames: scaleFrames(item.clip.transition.durationInFrames, sourceFps, renderFps),
        }
      : item.clip.transition,
    attachment: item.clip.attachment?.audio
      ? {
          ...item.clip.attachment,
          audio: {
            ...item.clip.attachment.audio,
            src: toRenderSource(item.clip.attachment.audio.src),
          },
        }
      : item.clip.attachment,
  }
}

function normalizeBgmForRender(bgm: BgmClip, sourceFps: number, renderFps: number): BgmClip {
  return {
    ...bgm,
    src: toRenderSource(bgm.src),
    startFrame: scaleFrames(bgm.startFrame, sourceFps, renderFps),
    durationInFrames: Math.max(1, scaleFrames(bgm.durationInFrames, sourceFps, renderFps)),
    fadeIn: bgm.fadeIn === undefined ? bgm.fadeIn : scaleFrames(bgm.fadeIn, sourceFps, renderFps),
    fadeOut: bgm.fadeOut === undefined ? bgm.fadeOut : scaleFrames(bgm.fadeOut, sourceFps, renderFps),
  }
}

async function normalizeProjectForRender(project: VideoEditorProject): Promise<VideoEditorProject> {
  const sourceFps = sanitizeFps(project.config.fps) || 30
  const clipsWithMetadata = await Promise.all(project.timeline.map(async (clip) => {
    const src = toRenderSource(clip.src)
    return {
      clip,
      src,
      metadata: await readVideoMetadata(clip.src, src),
    }
  }))
  const renderFps = resolveRenderFps(sourceFps, clipsWithMetadata)

  return {
    ...project,
    config: {
      ...project.config,
      fps: renderFps,
    },
    timeline: clipsWithMetadata.map((item) => normalizeClipForRender(item, sourceFps, renderFps)),
    bgmTrack: project.bgmTrack.map((bgm) => normalizeBgmForRender(bgm, sourceFps, renderFps)),
  }
}

export async function renderVideoComposeProject(
  project: VideoEditorProject,
  onProgress?: (progress: number) => Promise<void> | void,
) {
  const renderProject = await normalizeProjectForRender(project)
  const inputProps = {
    clips: renderProject.timeline,
    bgmTrack: renderProject.bgmTrack,
    config: renderProject.config,
  }
  const entryPoint = path.join(
    process.cwd(),
    'src',
    'features',
    'video-editor',
    'remotion',
    'VideoCompositionEntry.tsx',
  )
  const workDir = path.join(tmpdir(), `waoowaoo-compose-${randomUUID()}`)

  await mkdir(workDir, { recursive: true })
  try {
    const serveUrl = await bundle({
      entryPoint,
      onProgress: (progress) => {
        void onProgress?.(Math.round(progress * 20))
      },
    })
    const composition = await selectComposition({
      serveUrl,
      id: VIDEO_COMPOSITION_ID,
      inputProps,
      logLevel: 'warn',
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    })
    const outputLocation = path.join(workDir, 'output.mp4')

    await renderMedia({
      serveUrl,
      composition,
      codec: 'h264',
      inputProps,
      outputLocation,
      overwrite: true,
      logLevel: 'warn',
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      onProgress: ({ progress }) => {
        void onProgress?.(20 + Math.round(progress * 65))
      },
    })

    const buffer = await readFile(outputLocation)
    const outputKey = generateUniqueKey(`video-compose-${project.episodeId}`, 'mp4')
    await uploadObject(buffer, outputKey, 1, 'video/mp4')
    await onProgress?.(95)

    return {
      outputKey,
      sizeBytes: buffer.length,
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
