import { NextRequest, NextResponse } from 'next/server'
import { logAuthAction } from '@/lib/logging/semantic'
import { findOrCreateSsoLocalUser } from '@/lib/sso/local-user'
import { setNextAuthSsoSessionCookie } from '@/lib/sso/next-auth-session'
import { verifyAiTrainingSsoTicket, type SsoTicketVerifyError } from '@/lib/sso/ticket'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    locale: string
  }>
}

function isSafeSameSitePath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false
  try {
    const parsed = new URL(value, 'http://localhost')
    return parsed.origin === 'http://localhost'
  } catch {
    return false
  }
}

function resolveReturnTo(req: NextRequest, locale: string): string {
  const requested = req.nextUrl.searchParams.get('returnTo') || ''
  if (requested && isSafeSameSitePath(requested)) return requested
  return `/${locale}/home`
}

function resolvePublicOrigin(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (forwardedProto && forwardedHost && !forwardedHost.startsWith('0.0.0.0')) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const origin = req.nextUrl.origin
  if (!origin.includes('://0.0.0.0')) {
    return origin
  }

  const configuredOrigin = process.env.NEXTAUTH_URL?.trim()
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin
    } catch {
      // 配置错误时退回请求来源。
    }
  }

  return origin.replace('://0.0.0.0', '://localhost')
}

function buildFailureRedirect(req: NextRequest, locale: string): NextResponse {
  const redirectUrl = new URL(`/${locale}/auth/signin`, resolvePublicOrigin(req))
  redirectUrl.searchParams.set('error', 'SsoTicketInvalid')
  return NextResponse.redirect(redirectUrl)
}

function getErrorLogDetails(error: unknown): Record<string, unknown> {
  const ssoError = error as Partial<SsoTicketVerifyError>
  return {
    error: ssoError.code || (error instanceof Error ? error.name : 'UnknownError'),
    status: typeof ssoError.status === 'number' ? ssoError.status : undefined,
    ...(typeof ssoError.details === 'object' && ssoError.details ? ssoError.details : {}),
  }
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { locale } = await ctx.params
  const ticket = req.nextUrl.searchParams.get('ticket') || ''

  if (!ticket.trim()) {
    logAuthAction('SSO_LOGIN', 'ticket missing', { error: 'TICKET_MISSING' })
    return buildFailureRedirect(req, locale)
  }

  try {
    const profile = await verifyAiTrainingSsoTicket(ticket)
    const identity = await findOrCreateSsoLocalUser(profile)
    const redirectUrl = new URL(resolveReturnTo(req, locale), resolvePublicOrigin(req))
    const response = NextResponse.redirect(redirectUrl)

    await setNextAuthSsoSessionCookie(response, identity.user, identity.displayName)
    logAuthAction('SSO_LOGIN', 'ticket consumed', {
      userId: identity.user.id,
      provider: 'ai-training-ticket-sso',
      success: true,
    })

    return response
  } catch (error) {
    logAuthAction('SSO_LOGIN', 'ticket consume failed', getErrorLogDetails(error))
    return buildFailureRedirect(req, locale)
  }
}
