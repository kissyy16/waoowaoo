import { describe, expect, it } from 'vitest'
import {
  allocateClipDurations,
  buildStoryToScriptDurationGuidance,
  normalizePanelDurations,
} from '@/lib/novel-promotion/duration-planning'

describe('duration-planning', () => {
  it('allocates clip durations that add up to the fixed target duration', () => {
    const durations = allocateClipDurations([
      { id: 'clip-1', content: '短开场' },
      { id: 'clip-2', content: '这里是一段更长的主要冲突内容' },
      { id: 'clip-3', content: '结尾' },
    ], 30)

    const values = Array.from(durations.values())
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(30)
    expect(Math.min(...values)).toBeGreaterThanOrEqual(4)
  })

  it('normalizes storyboard panel durations to the requested clip duration', () => {
    const panels = normalizePanelDurations([
      { panel_number: 1, description: '开场', duration: 4 },
      { panel_number: 2, description: '主冲突推进', duration: 8 },
      { panel_number: 3, description: '反转收束', duration: 6 },
    ], 20)

    expect(panels.map((panel) => panel.duration)).toEqual([6, 7, 7])
    expect(panels.reduce((sum, panel) => sum + (panel.duration || 0), 0)).toBe(20)
  })

  it('keeps automatic mode prompt guidance empty', () => {
    expect(buildStoryToScriptDurationGuidance(null)).toBe('')
  })
})
