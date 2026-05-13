import { describe, expect, it } from 'vitest'
import { TASK_TYPE } from '@/lib/task/types'
import { resolveTaskIntent } from '@/lib/task/intent'
import { getTaskStageLabel, getTaskTypeLabel } from '@/lib/task/progress-message'

describe('resolveTaskIntent', () => {
  it('maps generate task types', () => {
    expect(resolveTaskIntent(TASK_TYPE.IMAGE_CHARACTER)).toBe('generate')
    expect(resolveTaskIntent(TASK_TYPE.IMAGE_LOCATION)).toBe('generate')
    expect(resolveTaskIntent(TASK_TYPE.VIDEO_PANEL)).toBe('generate')
    expect(resolveTaskIntent(TASK_TYPE.VIDEO_COMPOSE)).toBe('process')
    expect(resolveTaskIntent(TASK_TYPE.AI_STORY_EXPAND)).toBe('generate')
  })

  it('maps video compose progress labels', () => {
    expect(getTaskTypeLabel(TASK_TYPE.VIDEO_COMPOSE)).toBe('progress.taskType.videoCompose')
    expect(getTaskStageLabel('compose_prepare')).toBe('progress.stage.composePrepare')
    expect(getTaskStageLabel('compose_render')).toBe('progress.stage.composeRender')
    expect(getTaskStageLabel('compose_upload')).toBe('progress.stage.composeUpload')
    expect(getTaskStageLabel('compose_persist')).toBe('progress.stage.composePersist')
  })

  it('maps regenerate and modify task types', () => {
    expect(resolveTaskIntent(TASK_TYPE.REGENERATE_GROUP)).toBe('regenerate')
    expect(resolveTaskIntent(TASK_TYPE.PANEL_VARIANT)).toBe('regenerate')
    expect(resolveTaskIntent(TASK_TYPE.MODIFY_ASSET_IMAGE)).toBe('modify')
  })

  it('falls back to process for unknown types', () => {
    expect(resolveTaskIntent('unknown_type')).toBe('process')
    expect(resolveTaskIntent(null)).toBe('process')
    expect(resolveTaskIntent(undefined)).toBe('process')
  })
})
