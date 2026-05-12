import { NextRequest } from 'next/server'
import { requireProjectAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { normalizeTargetDurationSeconds } from '@/lib/video-duration'

export const runtime = 'nodejs'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const body = await request.json().catch(() => ({}))
  const episodeId = typeof body?.episodeId === 'string' ? body.episodeId.trim() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }
  if (!content) {
    throw new ApiError('INVALID_PARAMS')
  }
  const hasTargetDuration = Object.prototype.hasOwnProperty.call(body, 'targetDurationSeconds')
  const targetDurationSeconds = normalizeTargetDurationSeconds(body?.targetDurationSeconds)
  if (hasTargetDuration && targetDurationSeconds === undefined) {
    throw new ApiError('INVALID_PARAMS')
  }

  const authResult = await requireProjectAuth(projectId, {
    include: { characters: true, locations: true },
  })
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const taskBody: Record<string, unknown> = {
    ...body,
    displayMode: 'detail',
  }
  if (typeof targetDurationSeconds === 'number') {
    taskBody.targetDurationSeconds = targetDurationSeconds
  } else {
    delete taskBody.targetDurationSeconds
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    episodeId,
    type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    routePath: `/api/novel-promotion/${projectId}/story-to-script-stream`,
    body: taskBody,
    dedupeKey: `story_to_script_run:${episodeId}`,
    priority: 2,
  })
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
