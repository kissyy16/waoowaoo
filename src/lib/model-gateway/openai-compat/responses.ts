import { buildOpenAIChatCompletion } from '@/lib/llm/providers/openai-compat'
import { buildReasoningAwareContent } from '@/lib/llm/utils'
import type { OpenAICompatChatRequest } from '../types'
import { resolveOpenAICompatClientConfig } from './common'

type ResponsesUsage = {
  promptTokens: number
  completionTokens: number
}

type ErrorWithStatus = Error & { status?: number }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function collectText(node: unknown, acc: string[]) {
  if (typeof node === 'string') {
    acc.push(node)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectText(item, acc))
    return
  }
  const record = asRecord(node)
  if (!record) return

  const type = typeof record.type === 'string' ? record.type : ''
  if (type.includes('reasoning') || type.includes('summary')) return
  if (typeof record.output_text === 'string') acc.push(record.output_text)
  if (typeof record.text === 'string') acc.push(record.text)
  if (typeof record.content === 'string') acc.push(record.content)
  if (record.content !== undefined && typeof record.content !== 'string') collectText(record.content, acc)
  if (record.output !== undefined) collectText(record.output, acc)
}

function collectReasoning(node: unknown, acc: string[], inReasoningContent = false) {
  if (typeof node === 'string') {
    if (inReasoningContent) acc.push(node)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectReasoning(item, acc, inReasoningContent))
    return
  }
  const record = asRecord(node)
  if (!record) return

  const type = typeof record.type === 'string' ? record.type : ''
  const isReasoningNode = type.includes('reasoning') || type.includes('summary') || type.includes('think')
  const shouldCollectDirectText = inReasoningContent || isReasoningNode
  if (shouldCollectDirectText) {
    if (typeof record.text === 'string') acc.push(record.text)
    if (typeof record.content === 'string') acc.push(record.content)
    if (record.content !== undefined && typeof record.content !== 'string') {
      collectReasoning(record.content, acc, true)
    }
  }

  if (record.summary !== undefined) collectReasoning(record.summary, acc, shouldCollectDirectText)
  if (record.reasoning !== undefined) collectReasoning(record.reasoning, acc)
  if (record.reasoning_content !== undefined) collectReasoning(record.reasoning_content, acc, true)
  if (record.reasoningContent !== undefined) collectReasoning(record.reasoningContent, acc, true)
  if (record.thinking !== undefined) collectReasoning(record.thinking, acc, true)
  if (record.output !== undefined) collectReasoning(record.output, acc)
}

function extractResponsesText(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''
  if (typeof root.output_text === 'string') return root.output_text

  const parts: string[] = []
  collectText(root.output ?? root, parts)
  return parts.join('')
}

function extractResponsesReasoning(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''

  const parts: string[] = []
  collectReasoning(root.output ?? root, parts)
  return parts.join('')
}

function extractResponsesUsage(payload: unknown): ResponsesUsage {
  const usage = asRecord(asRecord(payload)?.usage) || {}
  const promptTokens = typeof usage.input_tokens === 'number'
    ? usage.input_tokens
    : (typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0)
  const completionTokens = typeof usage.output_tokens === 'number'
    ? usage.output_tokens
    : (typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0)
  return {
    promptTokens,
    completionTokens,
  }
}

function mapResponsesReasoningEffort(
  effort: OpenAICompatChatRequest['reasoningEffort'],
): 'low' | 'medium' | 'high' {
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort
  return 'high'
}

export async function runOpenAICompatResponsesCompletion(input: OpenAICompatChatRequest) {
  const config = await resolveOpenAICompatClientConfig(input.userId, input.providerId)
  const endpoint = toEndpoint(config.baseUrl, '/responses')
  const body: Record<string, unknown> = {
    model: input.modelId,
    input: input.messages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
    temperature: input.temperature,
  }
  if (input.reasoning !== false) {
    body.reasoning = {
      effort: mapResponsesReasoningEffort(input.reasoningEffort),
      summary: 'auto',
    }
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    const error = new Error(
      `OPENAI_COMPAT_RESPONSES_FAILED: ${response.status} ${errorBody.slice(0, 300)}`,
    ) as ErrorWithStatus
    error.status = response.status
    throw error
  }

  const payload = await response.json() as unknown
  const text = extractResponsesText(payload)
  const reasoning = extractResponsesReasoning(payload)
  const usage = extractResponsesUsage(payload)

  return buildOpenAIChatCompletion(
    input.modelId,
    buildReasoningAwareContent(text, reasoning),
    usage,
  )
}

