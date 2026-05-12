export const VIDEO_DURATION_AUTO_VALUE = 'auto'
export const VIDEO_DURATION_PRESET_SECONDS = [5, 10, 20, 30] as const
export const TARGET_DURATION_MIN_SECONDS = 5
export const TARGET_DURATION_MAX_SECONDS = 120
export const PANEL_DURATION_MIN_SECONDS = 4
export const PANEL_DURATION_MAX_SECONDS = 15

export type TargetDurationSeconds = number | null

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) ? parsed : null
}

export function isValidTargetDurationSeconds(value: number): boolean {
  return Number.isInteger(value)
    && value >= TARGET_DURATION_MIN_SECONDS
    && value <= TARGET_DURATION_MAX_SECONDS
}

export function normalizeTargetDurationSeconds(value: unknown): TargetDurationSeconds | undefined {
  if (value === undefined) return undefined
  if (value === null || value === VIDEO_DURATION_AUTO_VALUE || value === '') return null

  const seconds = toInteger(value)
  if (seconds === null || !isValidTargetDurationSeconds(seconds)) return undefined
  return seconds
}

export function formatVideoDurationLabel(value: TargetDurationSeconds): string {
  return value === null ? '自动' : `${value}s`
}
