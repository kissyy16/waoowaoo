import { NextRequest } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireAdminAuth, requireUserAuth } from '@/lib/api-auth'
import { getSystemConfigOwnerUserId } from '@/lib/system-config-owner'
import {
  AssistantPlatformError,
  createAssistantChatResponse,
  isAssistantId,
} from '@/lib/assistant-platform'

type RequestBody = {
  assistantId?: unknown
  messages?: unknown
  context?: unknown
}

function readAssistantId(value: unknown): 'api-config-template' | 'tutorial' {
  if (!isAssistantId(value)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'ASSISTANT_INVALID_REQUEST',
      field: 'assistantId',
      message: 'assistantId must be api-config-template or tutorial',
    })
  }
  return value
}

function mapAssistantError(error: AssistantPlatformError): ApiError {
  if (error.code === 'ASSISTANT_MODEL_NOT_CONFIGURED') {
    return new ApiError('MISSING_CONFIG', {
      code: error.code,
      message: 'analysisModel is required before using assistant',
    })
  }

  if (error.code === 'ASSISTANT_INVALID_REQUEST' || error.code === 'ASSISTANT_CONTEXT_REQUIRED') {
    return new ApiError('INVALID_PARAMS', {
      code: error.code,
      message: error.message,
    })
  }

  if (error.code === 'ASSISTANT_SKILL_NOT_FOUND') {
    return new ApiError('INVALID_PARAMS', {
      code: error.code,
      message: error.message,
    })
  }

  return new ApiError('EXTERNAL_ERROR', {
    code: error.code,
    message: error.message,
  })
}

export const POST = apiHandler(async (request: NextRequest) => {
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    throw new ApiError('INVALID_PARAMS', {
      code: 'BODY_PARSE_FAILED',
      field: 'body',
      message: 'request body must be valid JSON',
    })
  }

  const assistantId = readAssistantId(body.assistantId)
  const authResult = assistantId === 'api-config-template'
    ? await requireAdminAuth()
    : await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const userId = assistantId === 'api-config-template'
    ? await getSystemConfigOwnerUserId(authResult.session.user.id)
    : authResult.session.user.id

  try {
    return await createAssistantChatResponse({
      userId,
      assistantId,
      context: body.context,
      messages: body.messages,
    })
  } catch (error) {
    if (error instanceof AssistantPlatformError) {
      throw mapAssistantError(error)
    }
    throw error
  }
})
