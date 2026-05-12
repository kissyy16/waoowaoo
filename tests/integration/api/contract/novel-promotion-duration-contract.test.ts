import { describe, expect, it } from 'vitest'
import {
  PANEL_DURATION_MAX_SECONDS,
  PANEL_DURATION_MIN_SECONDS,
  TARGET_DURATION_MAX_SECONDS,
  TARGET_DURATION_MIN_SECONDS,
  VIDEO_DURATION_AUTO_VALUE,
  VIDEO_DURATION_PRESET_SECONDS,
  normalizeTargetDurationSeconds,
} from '@/lib/video-duration'

describe('api contract - novel promotion target duration', () => {
  it('accepts auto and preset/custom target durations within the public range', () => {
    expect(normalizeTargetDurationSeconds(VIDEO_DURATION_AUTO_VALUE)).toBeNull()
    expect(normalizeTargetDurationSeconds(null)).toBeNull()

    for (const seconds of VIDEO_DURATION_PRESET_SECONDS) {
      expect(normalizeTargetDurationSeconds(seconds)).toBe(seconds)
    }

    expect(normalizeTargetDurationSeconds(TARGET_DURATION_MIN_SECONDS)).toBe(TARGET_DURATION_MIN_SECONDS)
    expect(normalizeTargetDurationSeconds(TARGET_DURATION_MAX_SECONDS)).toBe(TARGET_DURATION_MAX_SECONDS)
  })

  it('rejects invalid target durations and keeps per-panel durations provider-safe', () => {
    expect(normalizeTargetDurationSeconds(TARGET_DURATION_MIN_SECONDS - 1)).toBeUndefined()
    expect(normalizeTargetDurationSeconds(TARGET_DURATION_MAX_SECONDS + 1)).toBeUndefined()
    expect(normalizeTargetDurationSeconds('abc')).toBeUndefined()

    expect(PANEL_DURATION_MIN_SECONDS).toBe(4)
    expect(PANEL_DURATION_MAX_SECONDS).toBe(15)
  })
})
