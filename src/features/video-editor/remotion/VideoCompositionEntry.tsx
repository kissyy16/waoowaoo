import React from 'react'
import { Composition, registerRoot } from 'remotion'
import { VideoComposition } from './VideoComposition'
import { calculateTimelineDuration } from '../utils/time-utils'
import type { BgmClip, EditorConfig, VideoClip } from '../types/editor.types'

export const VIDEO_COMPOSITION_ID = 'VideoComposition'

type VideoCompositionInputProps = {
  clips: VideoClip[]
  bgmTrack: BgmClip[]
  config: EditorConfig
}

const defaultInputProps: VideoCompositionInputProps = {
  clips: [],
  bgmTrack: [],
  config: {
    fps: 30,
    width: 1920,
    height: 1080,
  },
}

const VideoCompositionRoot: React.FC<Record<string, unknown>> = (props) => (
  <VideoComposition {...(props as VideoCompositionInputProps)} />
)

const RemotionRoot: React.FC = () => (
  <Composition
    id={VIDEO_COMPOSITION_ID}
    component={VideoCompositionRoot}
    durationInFrames={1}
    fps={defaultInputProps.config.fps}
    width={defaultInputProps.config.width}
    height={defaultInputProps.config.height}
    defaultProps={defaultInputProps}
    calculateMetadata={({ props }) => {
      const input = props as VideoCompositionInputProps
      const config = input.config || defaultInputProps.config
      return {
        durationInFrames: Math.max(1, calculateTimelineDuration(input.clips || [])),
        fps: config.fps || defaultInputProps.config.fps,
        width: config.width || defaultInputProps.config.width,
        height: config.height || defaultInputProps.config.height,
      }
    }}
  />
)

registerRoot(RemotionRoot)
