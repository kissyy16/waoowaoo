import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { resolveMediaRefFromLegacyValue } from '@/lib/media/service'
import {
  buildVideoComposeProject,
  resolveComposeDimensions,
  VideoComposeValidationError,
} from '@/lib/novel-promotion/video-compose'

function parseProjectData(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function serializeEditorProject(editorProject: {
  id: string
  episodeId: string
  projectData: string
  renderStatus: string | null
  renderTaskId: string | null
  outputUrl: string | null
  updatedAt: Date
}) {
  const outputMedia = await resolveMediaRefFromLegacyValue(editorProject.outputUrl)
  const latestTask = await prisma.task.findFirst({
    where: {
      targetType: 'VideoEditorProject',
      targetId: editorProject.id,
      type: TASK_TYPE.VIDEO_COMPOSE,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      errorCode: true,
      errorMessage: true,
    },
  })

  return {
    id: editorProject.id,
    episodeId: editorProject.episodeId,
    projectData: parseProjectData(editorProject.projectData),
    renderStatus: editorProject.renderStatus,
    renderTaskId: editorProject.renderTaskId,
    outputUrl: outputMedia?.url || editorProject.outputUrl,
    outputKey: outputMedia?.storageKey || editorProject.outputUrl,
    taskStatus: latestTask?.status || null,
    errorCode: latestTask?.errorCode || null,
    errorMessage: latestTask?.errorMessage || null,
    updatedAt: editorProject.updatedAt,
  }
}

export const GET = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const episodeId = request.nextUrl.searchParams.get('episodeId')
  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const editorProject = await prisma.videoEditorProject.findFirst({
    where: {
      episodeId,
      episode: {
        novelPromotionProject: {
          projectId,
        },
      },
    },
  })

  if (!editorProject) {
    return NextResponse.json({ projectData: null }, { status: 200 })
  }

  return NextResponse.json(await serializeEditorProject(editorProject))
})

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const episodeId = typeof body?.episodeId === 'string' ? body.episodeId.trim() : ''
  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const episode = await prisma.novelPromotionEpisode.findFirst({
    where: {
      id: episodeId,
      novelPromotionProject: {
        projectId,
      },
    },
    include: {
      novelPromotionProject: {
        select: {
          videoRatio: true,
        },
      },
      clips: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
        },
      },
      storyboards: {
        orderBy: { createdAt: 'asc' },
        include: {
          clip: {
            select: {
              start: true,
              end: true,
              createdAt: true,
            },
          },
          panels: {
            orderBy: { panelIndex: 'asc' },
            select: {
              id: true,
              storyboardId: true,
              panelIndex: true,
              description: true,
              duration: true,
              videoUrl: true,
              lipSyncVideoUrl: true,
            },
          },
        },
      },
    },
  })

  if (!episode) {
    throw new ApiError('NOT_FOUND')
  }

  const existingProject = await prisma.videoEditorProject.findUnique({
    where: { episodeId },
    select: { id: true },
  })

  const dimensions = resolveComposeDimensions(episode.novelPromotionProject.videoRatio)
  let projectData
  try {
    projectData = buildVideoComposeProject(episode, {
      projectId: existingProject?.id,
      width: dimensions.width,
      height: dimensions.height,
    })
  } catch (error) {
    if (error instanceof VideoComposeValidationError) {
      throw new ApiError('INVALID_PARAMS', {
        code: error.code,
        message: error.message,
        details: error.details,
      })
    }
    throw error
  }

  const editorProject = await prisma.videoEditorProject.upsert({
    where: { episodeId },
    create: {
      episodeId,
      projectData: JSON.stringify(projectData),
      renderStatus: 'pending',
      renderTaskId: null,
      outputUrl: null,
    },
    update: {
      projectData: JSON.stringify(projectData),
      renderStatus: 'pending',
      renderTaskId: null,
      outputUrl: null,
      updatedAt: new Date(),
    },
  })

  const projectDataWithStableId = {
    ...projectData,
    id: editorProject.id,
  }

  if (projectData.id !== editorProject.id) {
    await prisma.videoEditorProject.update({
      where: { id: editorProject.id },
      data: {
        projectData: JSON.stringify(projectDataWithStableId),
      },
    })
  }

  const locale = resolveRequiredTaskLocale(request, body)
  let result
  try {
    result = await submitTask({
      userId: session.user.id,
      locale,
      requestId: getRequestId(request),
      projectId,
      episodeId,
      type: TASK_TYPE.VIDEO_COMPOSE,
      targetType: 'VideoEditorProject',
      targetId: editorProject.id,
      payload: {
        editorProjectId: editorProject.id,
      },
      dedupeKey: `video_compose:${editorProject.id}`,
      maxAttempts: 1,
      billingInfo: null,
    })
  } catch (error) {
    await prisma.videoEditorProject.update({
      where: { id: editorProject.id },
      data: {
        renderStatus: 'failed',
        renderTaskId: null,
      },
    }).catch(() => undefined)
    throw error
  }

  await prisma.videoEditorProject.update({
    where: { id: editorProject.id },
    data: {
      renderTaskId: result.taskId,
    },
  })

  return NextResponse.json({
    ...result,
    id: editorProject.id,
    episodeId,
    projectData: projectDataWithStableId,
    renderStatus: 'pending',
    renderTaskId: result.taskId,
    outputUrl: null,
  })
})
