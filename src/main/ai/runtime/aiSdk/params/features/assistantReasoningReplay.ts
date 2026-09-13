import { definePlugin } from '@cherrystudio/ai-core'
import { ENDPOINT_TYPE } from '@shared/data/types/model'
import type { LanguageModelMiddleware } from 'ai'

import type { RequestFeature } from '../feature'

/**
 * Assistant-controlled reasoning replay. `settings.reasoningInHistory: 'strip'`
 * drops reasoning parts from replayed assistant turns, so a long thread stops
 * re-sending every earlier draft. The model still generates and bills reasoning
 * — only the replay shrinks.
 *
 * Provider defaults outrank this toggle:
 * - It only fires on the OpenAI-compatible chat-completions endpoint. Anthropic
 *   thinking `signature`, Gemini thought signatures, Responses `encrypted_content`
 *   and the DeepSeek Responses replay fix (#18150) all need the parts intact.
 * - Even there, turns that performed a tool call keep their reasoning: thinking-mode
 *   dialects (DeepSeek, GLM, Kimi, MiniMax, …) reject a request whose tool-calling
 *   assistant turns lack `reasoning_content` (see patches/@ai-sdk__openai-compatible).
 *   Tool-free turns are the dead weight this toggle exists to cut.
 *
 * Distinct from {@link stripReasoningReplayFeature}, which is a provider
 * compatibility fix (the HuggingFace router 400s on reasoning input items) and
 * must stay on regardless of what the assistant asks for.
 */
export function createAssistantReasoningReplayMiddleware(): LanguageModelMiddleware {
  return {
    specificationVersion: 'v3',

    transformParams: async ({ params }) => {
      if (!Array.isArray(params.prompt)) return params
      return {
        ...params,
        prompt: params.prompt.map((message) => {
          if (message.role !== 'assistant') return message
          if (message.content.some((part) => part.type === 'tool-call')) return message
          const content = message.content.filter((part) => part.type !== 'reasoning')
          return content.length === message.content.length ? message : { ...message, content }
        })
      }
    }
  }
}

export const assistantReasoningReplayFeature: RequestFeature = {
  name: 'assistant-reasoning-replay',
  applies: (scope) =>
    scope.assistant?.settings.reasoningInHistory === 'strip' &&
    scope.endpointType === ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
  contributeModelAdapters: () => [
    definePlugin({
      name: 'assistant-reasoning-replay',
      enforce: 'pre',
      configureContext: (context) => {
        context.middlewares = context.middlewares || []
        context.middlewares.push(createAssistantReasoningReplayMiddleware())
      }
    })
  ]
}
