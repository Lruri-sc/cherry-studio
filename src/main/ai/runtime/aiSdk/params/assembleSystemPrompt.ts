/**
 * TODO：distinguish static and dynamic system prompt and xml-based user prompt
 */

import { replacePromptVariables } from '@main/utils/prompt'
import { DATE_VARIABLE, type SystemPromptSectionId, WEB_SEARCH_DATE_TEMPLATE } from '@shared/ai/systemPromptSections'
import type { Assistant } from '@shared/data/types/assistant'
import type { Model } from '@shared/data/types/model'
import type { ToolSet } from 'ai'

import { TOOL_SEARCH_TOOL_NAME } from '../../../tools/adapters/aiSdk/meta/toolSearch'
import type { ToolEntry } from '../../../tools/adapters/aiSdk/types'
import { CITATIONS_SYSTEM_PROMPT } from '../prompts/citations'
import { getDeferredToolsSystemPrompt, renderDeferredToolsSection } from '../prompts/deferredTools'

export interface AssembleSystemPromptInput {
  assistant?: Assistant
  model: Model
  /** Final tool set going to the model — checked for `tool_search` membership. */
  tools?: ToolSet
  /** Entries hidden behind `tool_search`. Used to build the namespace inventory. */
  deferredEntries?: readonly ToolEntry[]
  /** True only when a selected first-party lookup tool with the citation-id contract remains available. */
  hasCitableTools?: boolean
  /** Add a volatile local-date anchor when this request can execute web search. */
  webSearchEnabled?: boolean
  /** Injectable clock for deterministic tests. */
  now?: Date
}

export async function assembleSystemPrompt(input: AssembleSystemPromptInput): Promise<string | undefined> {
  const { assistant, model, tools, deferredEntries, hasCitableTools = false, webSearchEnabled = false } = input

  const sections: string[] = []
  const now = input.now ?? new Date()
  const overrides = assistant?.settings.systemPromptSections

  // Absent override → Cherry's default, rebuilt for this request. '' → section left out.
  // Overrides go through the same variable substitution as the assistant prompt.
  const resolveSection = async (id: SystemPromptSectionId, buildDefault: () => string): Promise<string> => {
    const override = overrides?.[id]
    if (override === undefined) return buildDefault()
    if (override === '') return ''
    let text = override.replace(DATE_VARIABLE, formatLocalDate(now))
    if (id === 'deferredTools') text = renderDeferredToolsSection(text, deferredEntries)
    return replacePromptVariables(text, model.name)
  }
  const push = (text: string) => {
    if (text) sections.push(text)
  }

  // `anthropic-cache` checks the original assistant prompt for volatile time variables before caching.
  if (assistant?.prompt) {
    const resolved = await replacePromptVariables(assistant.prompt, model.name)
    if (resolved) sections.push(resolved)
  }

  if (tools && TOOL_SEARCH_TOOL_NAME in tools) {
    push(await resolveSection('deferredTools', () => getDeferredToolsSystemPrompt(deferredEntries)))
  }

  // No persisted-output section here: that protocol is taught in-band — the
  // marker itself carries the retrieval line (getVFSOffloadReminder) and the
  // fs_read tool description carries the paging + coverage contract — so
  // conversations that never truncate pay nothing for it.

  if (hasCitableTools) {
    push(await resolveSection('citations', () => CITATIONS_SYSTEM_PROMPT))
  }

  if (webSearchEnabled) {
    push(await resolveSection('webSearchDate', () => buildWebSearchDateContext(now)))
  }

  if (sections.length === 0) return undefined
  return sections.join('\n\n')
}

export function buildWebSearchDateContext(now: Date): string {
  return WEB_SEARCH_DATE_TEMPLATE.replace(DATE_VARIABLE, formatLocalDate(now))
}

function formatLocalDate(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
