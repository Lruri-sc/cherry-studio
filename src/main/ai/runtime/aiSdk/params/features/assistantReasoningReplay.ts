import { definePlugin } from '@cherrystudio/ai-core'
import { ENDPOINT_TYPE } from '@shared/data/types/model'

import type { RequestFeature } from '../feature'
import { createStripReasoningReplayMiddleware } from './stripReasoningReplay'

/**
 * Assistant-controlled reasoning replay. `settings.reasoningInHistory: 'strip'`
 * drops reasoning parts from replayed assistant turns, so a long thread stops
 * re-sending every earlier draft. The model still generates and bills reasoning
 * — only the replay shrinks.
 *
 * Provider defaults outrank this toggle. It only fires on the OpenAI-compatible
 * chat-completions endpoint, where replayed `reasoning_content` carries no
 * continuity contract. Elsewhere the replay is protocol: Anthropic thinking
 * `signature`, Gemini thought signatures, Responses `encrypted_content`, and the
 * DeepSeek Responses replay fix (#18150) all need the reasoning parts intact.
 *
 * Distinct from {@link stripReasoningReplayFeature}, which is a provider
 * compatibility fix (the HuggingFace router 400s on reasoning input items) and
 * must stay on regardless of what the assistant asks for.
 */
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
        context.middlewares.push(createStripReasoningReplayMiddleware())
      }
    })
  ]
}
