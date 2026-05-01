export { isCompatibleProvider, resolveModelGatewayRoute } from './router'
export type {
  ModelGatewayRoute,
  CompatibleProviderKey,
  OpenAICompatImageProfile,
  OpenAICompatVideoProfile,
  OpenAICompatClientConfig,
  OpenAICompatImageRequest,
  OpenAICompatVideoRequest,
  OpenAICompatChatRequest,
} from './types'
export {
  generateImageViaOpenAICompat,
  generateVideoViaOpenAICompat,
  generateImageViaOpenAICompatTemplate,
  generateVideoViaOpenAICompatTemplate,
  generateVideoViaNewApiCompat,
  isNewApiSeedanceVideoModel,
  isOpenAISoraStyleVideoTemplate,
  runOpenAICompatChatCompletion,
  runOpenAICompatChatCompletionStream,
  runOpenAICompatResponsesCompletion,
} from './openai-compat'
