import type { StoryboardPanel } from '@/lib/storyboard-phases'
import {
  PANEL_DURATION_MAX_SECONDS,
  PANEL_DURATION_MIN_SECONDS,
  isValidTargetDurationSeconds,
} from '@/lib/video-duration'

export type DurationPanelCountRange = {
  min: number
  max: number
  recommended: number
}

export type ClipDurationInput = {
  id: string
  content?: string | null
}

function assertTargetDuration(targetDurationSeconds: number) {
  if (!isValidTargetDurationSeconds(targetDurationSeconds)) {
    throw new Error(`Invalid targetDurationSeconds: ${targetDurationSeconds}`)
  }
}

function assertAllocatableDuration(durationSeconds: number) {
  if (
    !Number.isInteger(durationSeconds)
    || durationSeconds < PANEL_DURATION_MIN_SECONDS
    || durationSeconds > 120
  ) {
    throw new Error(`Invalid durationSeconds: ${durationSeconds}`)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function textWeight(value: unknown): number {
  return typeof value === 'string' && value.trim() ? value.trim().length : 1
}

function panelWeight(panel: StoryboardPanel): number {
  if (
    typeof panel.duration === 'number'
    && Number.isFinite(panel.duration)
    && panel.duration > 0
  ) {
    return panel.duration
  }
  return Math.max(
    textWeight(panel.source_text),
    textWeight(panel.description),
    textWeight(panel.video_prompt),
  )
}

function allocateIntegerSeconds(params: {
  totalSeconds: number
  weights: number[]
  minSeconds: number
  maxSeconds: number
}): number[] {
  const { totalSeconds, weights, minSeconds, maxSeconds } = params
  const count = weights.length
  if (count === 0) return []
  const minTotal = count * minSeconds
  const maxTotal = count * maxSeconds
  if (totalSeconds < minTotal || totalSeconds > maxTotal) {
    throw new Error(`Duration allocation impossible: total=${totalSeconds}, count=${count}, range=${minSeconds}-${maxSeconds}`)
  }

  const durations = Array.from({ length: count }, () => minSeconds)
  let remaining = totalSeconds - minTotal
  if (remaining === 0) return durations

  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 1))
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0) || count
  const fractional: Array<{ index: number; rest: number }> = []

  for (let index = 0; index < count; index += 1) {
    const capacity = maxSeconds - minSeconds
    const exact = (remaining * safeWeights[index]) / totalWeight
    const add = Math.min(capacity, Math.floor(exact))
    durations[index] += add
    fractional.push({ index, rest: exact - add })
  }

  remaining = totalSeconds - durations.reduce((sum, value) => sum + value, 0)
  fractional.sort((a, b) => b.rest - a.rest)

  let cursor = 0
  while (remaining > 0) {
    const item = fractional[cursor % fractional.length]
    if (durations[item.index] < maxSeconds) {
      durations[item.index] += 1
      remaining -= 1
    }
    cursor += 1
    if (cursor > fractional.length * (maxSeconds - minSeconds + 1)) {
      throw new Error('Duration allocation failed to distribute remaining seconds')
    }
  }

  return durations
}

export function resolvePanelCountRange(targetDurationSeconds: number): DurationPanelCountRange {
  assertAllocatableDuration(targetDurationSeconds)
  const min = Math.ceil(targetDurationSeconds / PANEL_DURATION_MAX_SECONDS)
  const max = Math.floor(targetDurationSeconds / PANEL_DURATION_MIN_SECONDS)
  const safeMax = Math.max(min, max)
  const recommended = clamp(Math.round(targetDurationSeconds / 6), min, safeMax)
  return { min, max: safeMax, recommended }
}

export function allocateClipDurations(
  clips: ClipDurationInput[],
  targetDurationSeconds: number,
): Map<string, number> {
  assertTargetDuration(targetDurationSeconds)
  if (clips.length === 0) return new Map()
  const durations = allocateIntegerSeconds({
    totalSeconds: targetDurationSeconds,
    weights: clips.map((clip) => textWeight(clip.content)),
    minSeconds: PANEL_DURATION_MIN_SECONDS,
    maxSeconds: targetDurationSeconds,
  })
  return new Map(clips.map((clip, index) => [clip.id, durations[index]]))
}

export function normalizePanelDurations(
  panels: StoryboardPanel[],
  targetDurationSeconds: number,
): StoryboardPanel[] {
  assertAllocatableDuration(targetDurationSeconds)
  if (panels.length === 0) return panels
  const durations = allocateIntegerSeconds({
    totalSeconds: targetDurationSeconds,
    weights: panels.map(panelWeight),
    minSeconds: PANEL_DURATION_MIN_SECONDS,
    maxSeconds: PANEL_DURATION_MAX_SECONDS,
  })
  return panels.map((panel, index) => ({
    ...panel,
    duration: durations[index],
  }))
}

export function buildStoryToScriptDurationGuidance(targetDurationSeconds: number | null | undefined): string {
  if (typeof targetDurationSeconds !== 'number') return ''
  assertTargetDuration(targetDurationSeconds)
  const range = resolvePanelCountRange(targetDurationSeconds)
  return `

【视频总时长约束】
目标成片总时长为 ${targetDurationSeconds} 秒。后续使用 Seedance 2.0 逐分镜生成视频，单个分镜视频时长必须在 ${PANEL_DURATION_MIN_SECONDS}-${PANEL_DURATION_MAX_SECONDS} 秒内。
请将片段切分控制在最多 ${range.max} 个片段以内，理想总分镜数约 ${range.recommended} 个，整体分镜数范围为 ${range.min}-${range.max} 个。
如果内容过长，请合并连续动作和场景，保留主线冲突，不要把一个短视频拆成过多片段。`
}

export function buildClipStoryboardDurationGuidance(params: {
  totalTargetDurationSeconds?: number | null
  clipTargetDurationSeconds?: number | null
}): string {
  const clipTargetDurationSeconds = params.clipTargetDurationSeconds
  if (typeof clipTargetDurationSeconds !== 'number') return ''
  assertAllocatableDuration(clipTargetDurationSeconds)
  const range = resolvePanelCountRange(clipTargetDurationSeconds)
  const totalLine = typeof params.totalTargetDurationSeconds === 'number'
    ? `整条视频目标总时长为 ${params.totalTargetDurationSeconds} 秒；当前片段分配时长为 ${clipTargetDurationSeconds} 秒。`
    : `当前片段目标时长为 ${clipTargetDurationSeconds} 秒。`
  return `

【分镜时长约束】
${totalLine}
请规划 ${range.min}-${range.max} 个分镜，推荐 ${range.recommended} 个；每个分镜必须输出整数 duration 字段，范围 ${PANEL_DURATION_MIN_SECONDS}-${PANEL_DURATION_MAX_SECONDS} 秒。
当前片段所有分镜的 duration 总和必须等于 ${clipTargetDurationSeconds} 秒。`
}
