export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

export function normalizeUserRole(value: unknown): UserRole {
  return value === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER
}

export function isAdminRole(value: unknown): boolean {
  return normalizeUserRole(value) === USER_ROLES.ADMIN
}

export function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}
