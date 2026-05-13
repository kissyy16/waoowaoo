import type { VideoEditorProject, VideoClip } from '@/features/video-editor/types/editor.types'

const DEFAULT_FPS = 30
const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080
const DEFAULT_PANEL_DURATION_SECONDS = 3

export class VideoComposeValidationError extends Error {
  readonly code = 'VIDEO_COMPOSE_INCOMPLETE'
  readonly details: Record<string, unknown>

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'VideoComposeValidationError'
    this.details = details
  }
}

export interface ComposePanelInput {
  id?: string | null
  storyboardId?: string | null
  panelIndex?: number | null
  description?: string | null
  duration?: number | null
  videoUrl?: string | null
  lipSyncVideoUrl?: string | null
}

export interface ComposeStoryboardInput {
  id: string
  clipId?: string | null
  createdAt?: Date | string | null
  panels?: ComposePanelInput[] | null
  clip?: {
    start?: number | null
    end?: number | null
    createdAt?: Date | string | null
  } | null
}

export interface ComposeEpisodeInput {
  id: string
  storyboards?: ComposeStoryboardInput[] | null
  clips?: Array<{
    id: string
    createdAt?: Date | string | null
  }> | null
}

export interface BuildVideoComposeProjectOptions {
  projectId?: string
  fps?: number
  width?: number
  height?: number
}

export interface OrderedComposePanel {
  storyboard: ComposeStoryboardInput
  panel: ComposePanelInput
  videoUrl: string
}

function readText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function toTimestamp(value: Date | string | null | undefined): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : 0
  }
  return 0
}

function compareNullableNumber(left: number | null | undefined, right: number | null | undefined): number {
  const a = typeof left === 'number' && Number.isFinite(left) ? left : Number.POSITIVE_INFINITY
  const b = typeof right === 'number' && Number.isFinite(right) ? right : Number.POSITIVE_INFINITY
  return a - b
}

function buildClipOrderMap(episode: ComposeEpisodeInput): Map<string, number> {
  const map = new Map<string, number>()
  for (const [index, clip] of (episode.clips || []).entries()) {
    map.set(clip.id, index)
  }
  return map
}

export function selectPanelComposeVideoUrl(panel: ComposePanelInput): string | null {
  return readText(panel.lipSyncVideoUrl) || readText(panel.videoUrl)
}

export function collectOrderedComposePanels(episode: ComposeEpisodeInput): OrderedComposePanel[] {
  const clipOrder = buildClipOrderMap(episode)
  const storyboards = [...(episode.storyboards || [])].sort((left, right) => {
    const clipDiff = (clipOrder.get(left.clipId || '') ?? Number.POSITIVE_INFINITY)
      - (clipOrder.get(right.clipId || '') ?? Number.POSITIVE_INFINITY)
    if (clipDiff !== 0) return clipDiff

    const startDiff = compareNullableNumber(left.clip?.start, right.clip?.start)
    if (startDiff !== 0) return startDiff

    return toTimestamp(left.createdAt || left.clip?.createdAt) - toTimestamp(right.createdAt || right.clip?.createdAt)
  })

  const orderedPanels = storyboards.flatMap((storyboard) => (
    [...(storyboard.panels || [])]
      .sort((left, right) => compareNullableNumber(left.panelIndex, right.panelIndex))
      .map((panel) => ({ storyboard, panel }))
  ))

  if (orderedPanels.length === 0) {
    throw new VideoComposeValidationError('No storyboard panels available for video composition', {
      episodeId: episode.id,
    })
  }

  const missing = orderedPanels
    .filter(({ panel }) => !selectPanelComposeVideoUrl(panel))
    .map(({ storyboard, panel }) => ({
      storyboardId: storyboard.id,
      panelId: panel.id || null,
      panelIndex: panel.panelIndex ?? null,
    }))

  if (missing.length > 0) {
    throw new VideoComposeValidationError('Some storyboard panels are missing generated videos', {
      episodeId: episode.id,
      missing,
    })
  }

  return orderedPanels.map(({ storyboard, panel }) => ({
    storyboard,
    panel,
    videoUrl: selectPanelComposeVideoUrl(panel)!,
  }))
}

export function isEpisodeVideoComplete(episode: ComposeEpisodeInput): boolean {
  try {
    collectOrderedComposePanels(episode)
    return true
  } catch {
    return false
  }
}

export function buildVideoComposeProject(
  episode: ComposeEpisodeInput,
  options: BuildVideoComposeProjectOptions = {},
): VideoEditorProject {
  const fps = options.fps || DEFAULT_FPS
  const orderedPanels = collectOrderedComposePanels(episode)
  const timeline: VideoClip[] = orderedPanels.map(({ storyboard, panel, videoUrl }, index) => {
    const durationSeconds = typeof panel.duration === 'number' && Number.isFinite(panel.duration) && panel.duration > 0
      ? panel.duration
      : DEFAULT_PANEL_DURATION_SECONDS
    return {
      id: `compose_clip_${index + 1}_${panel.id || `${storyboard.id}_${panel.panelIndex ?? index}`}`,
      src: videoUrl,
      durationInFrames: Math.max(1, Math.round(durationSeconds * fps)),
      metadata: {
        panelId: panel.id || `${storyboard.id}:${panel.panelIndex ?? index}`,
        storyboardId: storyboard.id,
        ...(readText(panel.description) ? { description: readText(panel.description)! } : {}),
      },
    }
  })

  return {
    id: options.projectId || `compose_${episode.id}`,
    episodeId: episode.id,
    schemaVersion: '1.0',
    config: {
      fps,
      width: options.width || DEFAULT_WIDTH,
      height: options.height || DEFAULT_HEIGHT,
    },
    timeline,
    bgmTrack: [],
  }
}

export function resolveComposeDimensions(videoRatio?: string | null): { width: number; height: number } {
  switch (videoRatio) {
    case '9:16':
      return { width: 1080, height: 1920 }
    case '1:1':
      return { width: 1080, height: 1080 }
    case '4:3':
      return { width: 1440, height: 1080 }
    case '3:4':
      return { width: 1080, height: 1440 }
    case '21:9':
      return { width: 1920, height: 822 }
    case '16:9':
    default:
      return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }
}
