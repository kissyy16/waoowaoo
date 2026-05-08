import { encode } from 'next-auth/jwt'
import type { NextResponse } from 'next/server'
import type { UserRole } from '@/lib/user-role'

const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export interface NextAuthSsoSessionUser {
  id: string
  role: UserRole
}

function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required to create SSO session')
  }
  return secret
}

function shouldUseSecureCookies(): boolean {
  return (process.env.NEXTAUTH_URL || '').startsWith('https://')
}

export function getNextAuthSessionCookieName(): string {
  return `${shouldUseSecureCookies() ? '__Secure-' : ''}next-auth.session-token`
}

export async function setNextAuthSsoSessionCookie(
  response: NextResponse,
  user: NextAuthSsoSessionUser,
  displayName: string,
): Promise<void> {
  const maxAge = DEFAULT_SESSION_MAX_AGE_SECONDS
  const expires = new Date(Date.now() + maxAge * 1000)
  const token = await encode({
    secret: getNextAuthSecret(),
    maxAge,
    token: {
      name: displayName,
      email: null,
      picture: null,
      sub: user.id,
      id: user.id,
      role: user.role,
    },
  })

  response.cookies.set(getNextAuthSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: shouldUseSecureCookies(),
    expires,
  })
}
