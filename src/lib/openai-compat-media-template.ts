export type TemplateHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type TemplateContentType =
  | 'application/json'
  | 'multipart/form-data'
  | 'application/x-www-form-urlencoded'

export type TemplateHeaderMap = Record<string, string>

export type TemplateBodyValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: TemplateBodyValue }
  | TemplateBodyValue[]

export interface TemplateEndpoint {
  method: TemplateHttpMethod
  path: string
  contentType?: TemplateContentType
  headers?: TemplateHeaderMap
  bodyTemplate?: TemplateBodyValue
  multipartFileFields?: string[]
}

export interface TemplateResponseMap {
  taskIdPath?: string
  statusPath?: string
  outputUrlPath?: string
  outputUrlsPath?: string
  errorPath?: string
}

export interface TemplatePollingConfig {
  intervalMs: number
  timeoutMs: number
  doneStates: string[]
  failStates: string[]
}

export interface OpenAICompatMediaTemplate {
  version: 1
  mediaType: 'image' | 'video'
  mode: 'sync' | 'async'
  create: TemplateEndpoint
  status?: TemplateEndpoint
  content?: TemplateEndpoint
  response: TemplateResponseMap
  polling?: TemplatePollingConfig
}

export function getDefaultOpenAICompatImageEditTemplate(): OpenAICompatMediaTemplate {
  return {
    version: 1,
    mediaType: 'image',
    mode: 'sync',
    create: {
      method: 'POST',
      path: '/images/edits',
      contentType: 'multipart/form-data',
      multipartFileFields: ['image'],
      bodyTemplate: {
        model: '{{model}}',
        prompt: '{{prompt}}',
        image: '{{images}}',
      },
    },
    response: {
      outputUrlPath: '$.data[0].b64_json',
      outputUrlsPath: '$.data',
      errorPath: '$.error.message',
    },
  }
}

export type OpenAICompatMediaTemplateSource = 'ai' | 'manual'

export const TEMPLATE_PLACEHOLDER_ALLOWLIST = new Set([
  'model',
  'prompt',
  'image',
  'images',
  'aspect_ratio',
  'duration',
  'resolution',
  'size',
  'width',
  'height',
  'fps',
  'seed',
  'task_id',
])
