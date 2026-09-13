import type { LanguageModelV3Prompt } from '@ai-sdk/provider'
import type { Assistant, AssistantSettings } from '@shared/data/types/assistant'
import type { EndpointType } from '@shared/data/types/model'
import { describe, expect, it } from 'vitest'

import type { RequestScope } from '../../scope'
import { assistantReasoningReplayFeature, createAssistantReasoningReplayMiddleware } from '../assistantReasoningReplay'

const scope = (
  settings: Partial<AssistantSettings> | undefined,
  endpointType: EndpointType = 'openai-chat-completions'
) =>
  ({
    assistant: settings ? ({ settings } as Assistant) : undefined,
    endpointType
  }) as unknown as RequestScope

const applies = assistantReasoningReplayFeature.applies!

describe('assistantReasoningReplayFeature.applies', () => {
  it('activates only on an explicit strip opt-in', () => {
    expect(applies(scope({ reasoningInHistory: 'strip' }))).toBe(true)
    // 'keep' is a real value, not a falsy absence — a truthiness check here would
    // silently strip for every assistant that has ever touched the toggle.
    expect(applies(scope({ reasoningInHistory: 'keep' }))).toBe(false)
    // Untouched assistants and assistant-less requests (API gateway) keep replaying.
    expect(applies(scope({}))).toBe(false)
    expect(applies(scope(undefined))).toBe(false)
  })

  it('yields to the provider wherever replayed reasoning is protocol, not dead weight', () => {
    const strip = { reasoningInHistory: 'strip' as const }
    // Anthropic requires the thinking `signature` echoed back; Gemini its thought
    // signature; Responses its `encrypted_content`. Stripping there breaks tool turns.
    expect(applies(scope(strip, 'anthropic-messages'))).toBe(false)
    expect(applies(scope(strip, 'google-generate-content'))).toBe(false)
    expect(applies(scope(strip, 'openai-responses'))).toBe(false)
    expect(applies(scope(strip, 'openai-chat-completions'))).toBe(true)
  })
})

describe('assistant reasoning replay middleware', () => {
  it('drops reasoning from tool-free turns but keeps it on turns that called a tool', async () => {
    const prompt: LanguageModelV3Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'draft' },
          { type: 'text', text: 'answer' }
        ]
      },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'plan the call' },
          { type: 'tool-call', toolCallId: 't1', toolName: 'search', input: { q: 'x' } }
        ]
      }
    ]
    const result = await createAssistantReasoningReplayMiddleware().transformParams!({
      type: 'stream',
      params: { prompt } as never,
      model: {} as never
    })
    expect(result.prompt[0]).toEqual(prompt[0])
    expect(result.prompt[1].content).toEqual([{ type: 'text', text: 'answer' }])
    // DeepSeek/GLM/Kimi/MiniMax reject a tool-calling turn that lost its reasoning_content.
    expect(result.prompt[2]).toEqual(prompt[2])
  })
})
