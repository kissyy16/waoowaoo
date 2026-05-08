import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, requireAdminAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import { isArtStyleValue } from '@/lib/constants'
import { getSystemConfigOwnerUserId } from '@/lib/system-config-owner'

function validateArtStyleField(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError('INVALID_PARAMS', {
      code: 'INVALID_ART_STYLE',
      field: 'artStyle',
      message: 'artStyle must be a supported value',
    })
  }
  const artStyle = value.trim()
  if (!isArtStyleValue(artStyle)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'INVALID_ART_STYLE',
      field: 'artStyle',
      message: 'artStyle must be a supported value',
    })
  }
  return artStyle
}

// GET - 获取用户偏好配置
export const GET = apiHandler(async () => {
  // 🔐 统一权限验证
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const userId = await getSystemConfigOwnerUserId(authResult.session.user.id)

  // 获取或创建管理员统一偏好；只返回运行时需要的安全默认值字段
  const preference = await prisma.userPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: {
      id: true,
      userId: true,
      analysisModel: true,
      characterModel: true,
      locationModel: true,
      storyboardModel: true,
      editModel: true,
      videoModel: true,
      audioModel: true,
      lipSyncModel: true,
      voiceDesignModel: true,
      videoRatio: true,
      artStyle: true,
      ttsRate: true,
      imageResolution: true,
      videoResolution: true,
    },
  })

  return NextResponse.json({ preference })
})

// PATCH - 更新用户偏好配置
export const PATCH = apiHandler(async (request: NextRequest) => {
  // 🔐 统一权限验证
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult
  const userId = await getSystemConfigOwnerUserId(authResult.session.user.id)

  const body = await request.json()

  // 只允许更新特定字段
  const allowedFields = [
    'analysisModel',
    'characterModel',
    'locationModel',
    'storyboardModel',
    'editModel',
    'videoModel',
    'audioModel',
    'lipSyncModel',
    'videoRatio',
    'artStyle',
    'ttsRate'
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === 'artStyle') {
        updateData[field] = validateArtStyleField(body[field])
        continue
      }
      updateData[field] = body[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  // 更新或创建用户偏好
  const preference = await prisma.userPreference.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      ...updateData
    }
  })

  return NextResponse.json({ preference })
})
