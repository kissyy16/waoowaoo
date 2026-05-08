import { createHash, createHmac, randomBytes } from 'node:crypto'
import { DEFAULT_AI_TRAINING_SSO_CLIENT_ID } from './constants'

const DEFAULT_VERIFY_TIMEOUT_MS = 5_000

export class SsoTicketVerifyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'SsoTicketVerifyError'
  }
}

export interface AiTrainingSsoProfile {
  valid: true
  sub?: string
  tenantId?: string
  userId?: string
  userName?: string
  name?: string
  displayName?: string
  preferredUsername?: string
  username?: string
  nickName?: string
  phone?: string
  mobile?: string
  email?: string
  departments?: unknown
  roles?: unknown
  [key: string]: unknown
}

interface TicketVerifyConfig {
  verifyUrl: string
  signaturePath?: string
  clientId: string
  clientSecret: string
  timeoutMs: number
}

export interface TicketSignatureInput {
  method: string
  path: string
  timestamp: string
  nonce: string
  body: string
  clientSecret: string
}

function readTicketVerifyConfig(): TicketVerifyConfig {
  const verifyUrl = process.env.AI_TRAINING_SSO_VERIFY_URL?.trim() || ''
  const signaturePath = process.env.AI_TRAINING_SSO_SIGNATURE_PATH?.trim() || ''
  const clientSecret = process.env.AI_TRAINING_SSO_CLIENT_SECRET?.trim() || ''
  const clientId = process.env.AI_TRAINING_SSO_CLIENT_ID?.trim() || DEFAULT_AI_TRAINING_SSO_CLIENT_ID
  const timeoutRaw = Number(process.env.AI_TRAINING_SSO_TIMEOUT_MS || DEFAULT_VERIFY_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : DEFAULT_VERIFY_TIMEOUT_MS

  if (!verifyUrl) {
    throw new SsoTicketVerifyError('AI training SSO verify URL is not configured', 'CONFIG_MISSING')
  }
  if (!clientSecret) {
    throw new SsoTicketVerifyError('AI training SSO client secret is not configured', 'CONFIG_MISSING')
  }

  return {
    verifyUrl,
    signaturePath: signaturePath || undefined,
    clientId,
    clientSecret,
    timeoutMs,
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function buildTicketVerifySignature(input: TicketSignatureInput): string {
  const signaturePayload = [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    sha256Hex(input.body),
  ].join('\n')

  return createHmac('sha256', input.clientSecret).update(signaturePayload, 'utf8').digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getVerifyUrlDetails(url: URL): Record<string, unknown> {
  return {
    verifyHost: url.hostname,
    verifyProtocol: url.protocol.replace(':', ''),
    verifyPort: url.port || (url.protocol === 'https:' ? '443' : '80'),
    verifyPath: url.pathname,
  }
}

function getNetworkFailureDetails(error: unknown, url: URL): Record<string, unknown> {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined
  const causeRecord = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : null
  const rawCode = causeRecord && typeof causeRecord.code === 'string' ? causeRecord.code : undefined

  return {
    ...getVerifyUrlDetails(url),
    errorName: error instanceof Error ? error.name : typeof error,
    causeCode: rawCode,
  }
}

function getHttpFailureDetails(response: Response, url: URL, payload: unknown): Record<string, unknown> {
  const responseCode = isRecord(payload) && (typeof payload.code === 'string' || typeof payload.code === 'number')
    ? payload.code
    : undefined

  return {
    ...getVerifyUrlDetails(url),
    responseCode,
    responseJson: isRecord(payload),
  }
}

function getSafePayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  const code = payload.code
  const message = payload.message ?? payload.msg
  const valid = payload.valid

  if (typeof code === 'string' || typeof code === 'number') output.responseCode = code
  if (typeof message === 'string') output.responseMessage = message.slice(0, 160)
  if (typeof valid === 'boolean') output.responseValid = valid
  return output
}

function unwrapTicketVerifyPayload(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null
  if (payload.valid === true) return payload

  const data = payload.data
  if (isRecord(data) && data.valid === true) return data

  return null
}

export function resolveSsoDisplayName(profile: Record<string, unknown>): string {
  return (
    asOptionalString(profile.name)
    || asOptionalString(profile.displayName)
    || asOptionalString(profile.preferredUsername)
    || asOptionalString(profile.username)
    || asOptionalString(profile.userName)
    || asOptionalString(profile.nickName)
    || 'AI培训平台用户'
  )
}

export function resolveSsoStableSubject(profile: Record<string, unknown>): string {
  const sub = asOptionalString(profile.sub)
  const tenantId = asOptionalString(profile.tenantId)
  const userId = asOptionalString(profile.userId)

  if (!sub && !userId) {
    throw new SsoTicketVerifyError('AI training SSO profile is missing stable user identity', 'IDENTITY_MISSING')
  }

  return [
    tenantId || 'default',
    sub || '',
    userId || '',
  ].join('\n')
}

export function buildSsoProviderAccountId(profile: Record<string, unknown>): string {
  return sha256Hex(resolveSsoStableSubject(profile))
}

export async function verifyAiTrainingSsoTicket(ticket: string): Promise<AiTrainingSsoProfile> {
  const trimmedTicket = ticket.trim()
  if (!trimmedTicket) {
    throw new SsoTicketVerifyError('SSO ticket is missing', 'TICKET_MISSING')
  }

  const config = readTicketVerifyConfig()
  const url = new URL(config.verifyUrl)
  const method = 'POST'
  const path = config.signaturePath || url.pathname
  const timestamp = Date.now().toString()
  const nonce = randomBytes(16).toString('hex')
  const body = JSON.stringify({ ticket: trimmedTicket })
  const signature = buildTicketVerifySignature({
    method,
    path,
    timestamp,
    nonce,
    body,
    clientSecret: config.clientSecret,
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'X-Sso-Client-Id': config.clientId,
        'X-Sso-Timestamp': timestamp,
        'X-Sso-Nonce': nonce,
        'X-Sso-Signature': signature,
      },
      body,
      signal: controller.signal,
    })
  } catch (error) {
    const code = error instanceof Error && error.name === 'AbortError' ? 'VERIFY_TIMEOUT' : 'VERIFY_NETWORK_ERROR'
    throw new SsoTicketVerifyError(
      'AI training SSO ticket verification request failed',
      code,
      undefined,
      getNetworkFailureDetails(error, url),
    )
  } finally {
    clearTimeout(timeout)
  }

  let payload: unknown = null
  let parsedJson = false
  try {
    payload = await response.json()
    parsedJson = true
  } catch {
    // 非 2xx 响应可能是网关或错误页 HTML，优先按 HTTP 状态归类。
  }

  if (!response.ok) {
    const code = isRecord(payload) && payload.valid === false ? 'TICKET_INVALID' : 'VERIFY_HTTP_ERROR'
    throw new SsoTicketVerifyError(
      'AI training SSO ticket verification failed',
      code,
      response.status,
      getHttpFailureDetails(response, url, payload),
    )
  }
  if (!parsedJson) {
    throw new SsoTicketVerifyError(
      'AI training SSO ticket verification returned invalid JSON',
      'VERIFY_INVALID_JSON',
      response.status,
      getVerifyUrlDetails(url),
    )
  }
  const verifiedProfile = unwrapTicketVerifyPayload(payload)
  if (!verifiedProfile) {
    throw new SsoTicketVerifyError(
      'AI training SSO ticket is invalid',
      'TICKET_INVALID',
      response.status,
      {
        ...getVerifyUrlDetails(url),
        ...(isRecord(payload) ? getSafePayloadSummary(payload) : {}),
      },
    )
  }

  resolveSsoStableSubject(verifiedProfile)
  return verifiedProfile as AiTrainingSsoProfile
}
