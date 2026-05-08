import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { USER_ROLES, normalizeUserRole, type UserRole } from '@/lib/user-role'
import { AI_TRAINING_SSO_PROVIDER } from './constants'
import { buildSsoProviderAccountId, resolveSsoDisplayName, type AiTrainingSsoProfile } from './ticket'

const MAX_USER_NAME_LENGTH = 120

export interface SsoLocalUser {
  id: string
  name: string
  role: UserRole
}

export interface SsoLoginIdentity {
  user: SsoLocalUser
  displayName: string
  providerAccountId: string
}

function normalizeDisplayName(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || 'AI培训平台用户'
}

function withSuffix(base: string, suffix: string): string {
  const room = Math.max(1, MAX_USER_NAME_LENGTH - suffix.length)
  return `${base.slice(0, room)}${suffix}`
}

async function allocateUniqueUserName(
  tx: Prisma.TransactionClient,
  displayName: string,
  providerAccountId: string,
): Promise<string> {
  const baseName = normalizeDisplayName(displayName).slice(0, MAX_USER_NAME_LENGTH)
  const existing = await tx.user.findUnique({
    where: { name: baseName },
    select: { id: true },
  })
  if (!existing) return baseName

  const shortHash = providerAccountId.slice(0, 10)
  const candidates = [
    withSuffix(baseName, `-${shortHash}`),
    withSuffix(baseName, `-${providerAccountId.slice(0, 16)}`),
    `sso-${providerAccountId}`,
  ]

  for (const candidate of candidates) {
    const taken = await tx.user.findUnique({
      where: { name: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }

  return `sso-${providerAccountId}-${Date.now().toString(36)}`.slice(0, MAX_USER_NAME_LENGTH)
}

export async function findOrCreateSsoLocalUser(profile: AiTrainingSsoProfile): Promise<SsoLoginIdentity> {
  const displayName = normalizeDisplayName(resolveSsoDisplayName(profile))
  const providerAccountId = buildSsoProviderAccountId(profile)

  const user = await prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AI_TRAINING_SSO_PROVIDER,
          providerAccountId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    })

    if (account?.user) {
      await tx.userBalance.upsert({
        where: { userId: account.user.id },
        create: {
          userId: account.user.id,
          balance: 0,
          frozenAmount: 0,
          totalSpent: 0,
        },
        update: {},
      })

      return account.user
    }

    const userName = await allocateUniqueUserName(tx, displayName, providerAccountId)
    const created = await tx.user.create({
      data: {
        name: userName,
        role: USER_ROLES.USER,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    })

    await tx.account.create({
      data: {
        userId: created.id,
        type: 'sso',
        provider: AI_TRAINING_SSO_PROVIDER,
        providerAccountId,
      },
    })

    await tx.userBalance.upsert({
      where: { userId: created.id },
      create: {
        userId: created.id,
        balance: 0,
        frozenAmount: 0,
        totalSpent: 0,
      },
      update: {},
    })

    return created
  })

  return {
    user: {
      id: user.id,
      name: user.name,
      role: normalizeUserRole(user.role),
    },
    displayName,
    providerAccountId,
  }
}
