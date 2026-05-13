import { describe, expect, it } from 'vitest'
import {
  VideoComposeValidationError,
  buildVideoComposeProject,
  collectOrderedComposePanels,
  selectPanelComposeVideoUrl,
} from '@/lib/novel-promotion/video-compose'

describe('video compose material builder', () => {
  it('orders clips and panels by script order, then panel index', () => {
    const ordered = collectOrderedComposePanels({
      id: 'episode-1',
      clips: [
        { id: 'clip-1', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'clip-2', createdAt: '2026-01-01T00:00:01.000Z' },
      ],
      storyboards: [
        {
          id: 'sb-2',
          clipId: 'clip-2',
          panels: [
            { id: 'p-3', storyboardId: 'sb-2', panelIndex: 1, videoUrl: 'video-3.mp4' },
            { id: 'p-2', storyboardId: 'sb-2', panelIndex: 0, videoUrl: 'video-2.mp4' },
          ],
        },
        {
          id: 'sb-1',
          clipId: 'clip-1',
          panels: [
            { id: 'p-1', storyboardId: 'sb-1', panelIndex: 0, videoUrl: 'video-1.mp4' },
          ],
        },
      ],
    })

    expect(ordered.map((item) => item.panel.id)).toEqual(['p-1', 'p-2', 'p-3'])
  })

  it('prefers lip-sync video and falls back to generated video', () => {
    expect(selectPanelComposeVideoUrl({
      videoUrl: 'base.mp4',
      lipSyncVideoUrl: 'lip.mp4',
    })).toBe('lip.mp4')

    const project = buildVideoComposeProject({
      id: 'episode-1',
      storyboards: [{
        id: 'sb-1',
        panels: [
          { id: 'p-1', storyboardId: 'sb-1', panelIndex: 0, videoUrl: 'base.mp4', lipSyncVideoUrl: 'lip.mp4', duration: 4 },
          { id: 'p-2', storyboardId: 'sb-1', panelIndex: 1, videoUrl: 'base-2.mp4', duration: 2 },
        ],
      }],
    })

    expect(project.timeline.map((clip) => clip.src)).toEqual(['lip.mp4', 'base-2.mp4'])
    expect(project.timeline.map((clip) => clip.durationInFrames)).toEqual([120, 60])
  })

  it('throws when any panel is missing video', () => {
    expect(() => collectOrderedComposePanels({
      id: 'episode-1',
      storyboards: [{
        id: 'sb-1',
        panels: [
          { id: 'p-1', storyboardId: 'sb-1', panelIndex: 0, videoUrl: 'base.mp4' },
          { id: 'p-2', storyboardId: 'sb-1', panelIndex: 1, videoUrl: '' },
        ],
      }],
    })).toThrow(VideoComposeValidationError)
  })
})
