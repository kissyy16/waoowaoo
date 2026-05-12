import type { Job } from 'bullmq'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'
import { isValidTargetDurationSeconds } from '@/lib/video-duration'

function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readTargetDurationSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !isValidTargetDurationSeconds(value)) return null
  return value
}

function appendDurationGuidance(prompt: string, targetDurationSeconds: number | null): string {
  if (targetDurationSeconds === null) return prompt
  return `${prompt}

【视频时长约束】
用户目标成片总时长为 ${targetDurationSeconds} 秒。请将故事密度、情节转折和文字长度控制为适合 ${targetDurationSeconds} 秒短视频的创意文本；不要按 1-2 分钟短片扩写。`
}

export async function handleAiStoryExpandTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const promptInput = readText(payload.prompt).trim()
  const analysisModel = readText(payload.analysisModel).trim()
  const targetDurationSeconds = readTargetDurationSeconds(payload.targetDurationSeconds)

  if (!promptInput) {
    throw new Error('prompt is required')
  }
  if (!analysisModel) {
    throw new Error('analysisModel is required')
  }

  const prompt = appendDurationGuidance(buildPrompt({
    promptId: PROMPT_IDS.NP_AI_STORY_EXPAND,
    locale: job.data.locale,
    variables: {
      input: promptInput,
    },
  }), targetDurationSeconds)

  await reportTaskProgress(job, 25, {
    stage: 'ai_story_expand_prepare',
    stageLabel: '准备故事扩写参数',
    displayMode: 'loading',
  })
  await assertTaskActive(job, 'ai_story_expand_prepare')

  const streamContext = createWorkerLLMStreamContext(job, 'ai_story_expand')
  const streamCallbacks = createWorkerLLMStreamCallbacks(job, streamContext)

  const completion = await withInternalLLMStreamCallbacks(
    streamCallbacks,
    async () =>
      await executeAiTextStep({
        userId: job.data.userId,
        model: analysisModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        projectId: job.data.projectId || 'home-ai-write',
        action: 'ai_story_expand',
        meta: {
          stepId: 'ai_story_expand',
          stepTitle: '故事扩写',
          stepIndex: 1,
          stepTotal: 1,
        },
      }),
  )
  await streamCallbacks.flush()
  await assertTaskActive(job, 'ai_story_expand_persist')

  const expandedText = completion.text.trim()
  if (!expandedText) {
    throw new Error('AI story expand response is empty')
  }

  await reportTaskProgress(job, 96, {
    stage: 'ai_story_expand_done',
    stageLabel: '故事扩写已完成',
    displayMode: 'loading',
  })

  return {
    expandedText,
  }
}
