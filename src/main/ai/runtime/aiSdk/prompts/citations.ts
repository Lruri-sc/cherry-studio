/**
 * Inline-citation guidance, appended to the system prompt only when a citable
 * lookup tool (web_search / web_fetch / kb_search / kb_read) is exposed to the
 * model. The text lives in `@shared/ai/systemPromptSections` so the assistant
 * editor can show (and override) the same default the runtime uses.
 */
export { CITATIONS_SYSTEM_PROMPT } from '@shared/ai/systemPromptSections'
