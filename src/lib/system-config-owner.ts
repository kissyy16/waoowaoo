import { prisma } from '@/lib/prisma'
import { USER_ROLES } from '@/lib/user-role'

export async function getSystemConfigOwnerUserId(fallbackUserId?: string): Promise<string> {
  if (process.env.NODE_ENV === 'test' && fallbackUserId) return fallbackUserId

  const configuredOwnerName = process.env.SYSTEM_CONFIG_OWNER_USER_ID?.trim()
  if (configuredOwnerName) {
    const configuredOwner = await prisma.user.findUnique({
      where: { name: configuredOwnerName },
      select: {
        id: true,
        role: true,
      },
    })

    if (!configuredOwner) {
      throw new Error(`SYSTEM_CONFIG_OWNER_NOT_FOUND: 未找到统一配置管理员账号 ${configuredOwnerName}`)
    }

    if (configuredOwner.role !== USER_ROLES.ADMIN) {
      throw new Error(`SYSTEM_CONFIG_OWNER_NOT_ADMIN: 统一配置账号 ${configuredOwnerName} 不是管理员`)
    }

    return configuredOwner.id
  }

  const userDelegate = (prisma as unknown as {
    user?: {
      findFirst?: (args: {
        where: { role: string }
        orderBy: { createdAt: 'asc' }
        select: { id: true }
      }) => Promise<{ id: string } | null>
    }
  }).user
  const admin = typeof userDelegate?.findFirst === 'function'
    ? await userDelegate.findFirst({
      where: { role: USER_ROLES.ADMIN },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    : null

  if (!admin) {
    throw new Error('SYSTEM_CONFIG_OWNER_NOT_FOUND: 请先创建管理员账号')
  }

  return admin.id
}
