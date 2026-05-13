import { describe, expect, it } from 'vitest'
import { useWorkspaceStageNavigation } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/hooks/useWorkspaceStageNavigation'

const t = (key: string) => key

describe('workspace stage navigation', () => {
  it('exposes compose instead of the legacy editor stage', () => {
    const items = useWorkspaceStageNavigation({
      isAnyOperationRunning: false,
      stageArtifacts: {
        hasStory: true,
        hasScript: true,
        hasStoryboard: true,
        hasVideo: true,
        hasVoice: false,
      },
      t,
    })

    expect(items.map((item) => item.id)).toEqual(['config', 'script', 'storyboard', 'videos', 'compose'])
    expect(items.find((item) => item.id === 'compose')).toMatchObject({
      label: 'stages.compose',
      disabled: false,
    })
    expect(items.some((item) => item.id === 'editor')).toBe(false)
  })

  it('keeps compose disabled until video artifacts exist', () => {
    const items = useWorkspaceStageNavigation({
      isAnyOperationRunning: false,
      stageArtifacts: {
        hasStory: true,
        hasScript: true,
        hasStoryboard: true,
        hasVideo: false,
        hasVoice: false,
      },
      t,
    })

    expect(items.find((item) => item.id === 'compose')).toMatchObject({
      disabled: true,
      disabledLabel: 'stages.composeNeedsVideos',
    })
  })
})
