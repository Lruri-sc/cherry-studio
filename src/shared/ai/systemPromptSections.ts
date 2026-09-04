import * as z from 'zod'

/**
 * The sections Cherry appends to the assistant's own system prompt, each only
 * when its trigger holds (tool_search exposed / a citable tool exposed / web
 * search enabled). An assistant may override any of them; an absent override
 * means "Cherry's default, rebuilt per request", '' means "leave it out".
 */
export const SYSTEM_PROMPT_SECTION_IDS = ['deferredTools', 'citations', 'webSearchDate'] as const
export type SystemPromptSectionId = (typeof SYSTEM_PROMPT_SECTION_IDS)[number]

/** Deferred-tools override placeholder for the live per-namespace inventory. */
export const NAMESPACES_VARIABLE = '{{namespaces}}'
/** Web-search-date placeholder, filled with the request's local YYYY-MM-DD. */
export const DATE_VARIABLE = '{{date}}'

export const DEFERRED_TOOLS_HEADER = `<deferred-tools>
Some tools are not loaded inline. Discover and call them through the meta-tools below.

<usage>
1. \`tool_search({ query?, namespace?, verbose? })\` — discover tools, grouped by namespace (e.g. \`web\`, \`kb\`, \`mcp:<server>\`). This is tool discovery, NOT web search. Pass \`verbose: true\` to include full input schemas.
2. \`tool_inspect({ name })\` — fetch a tool JSDoc signature to confirm its parameter names and shapes. Optional, but inspecting first (or searching with \`verbose: true\`) saves a round-trip.
3. \`tool_invoke({ name, params })\` — call a single tool. If you call one you haven't inspected, or pass params that don't match its signature, the call returns that tool's signature — read it and call again with corrected params.
</usage>`

export const CITATIONS_SYSTEM_PROMPT = `<citations>
When a statement in your answer is based on a web_search, web_fetch, kb_search, or kb_read result, append a citation marker immediately after that statement: [cite:ID], where ID is the exact \`id\` field of the supporting result item.
- Example: "Cherry Studio 2.0 entered beta in May. [cite:3f2a1b9c-2]"
- Chain markers when several results support one statement: [cite:3f2a1b9c-1][cite:7d4e0a51-3]
- Copy ids exactly as returned by the tool. Never invent, renumber, or reuse ids from other results.
- Do not add a "References" or "Sources" section at the end — the app renders citations from the inline markers.
- Statements from your own knowledge take no marker.
</citations>`

export const WEB_SEARCH_DATE_TEMPLATE = `<current-date>${DATE_VARIABLE}</current-date>
Interpret relative dates such as today, this month, and the last 30 days from this date. Do not substitute dates remembered from training or earlier conversation turns.`

/** Default text per section as the editor shows it; dynamic parts appear as placeholders. */
export const SYSTEM_PROMPT_SECTION_DEFAULTS: Record<SystemPromptSectionId, string> = {
  deferredTools: `${DEFERRED_TOOLS_HEADER}\n\n${NAMESPACES_VARIABLE}\n</deferred-tools>`,
  citations: CITATIONS_SYSTEM_PROMPT,
  webSearchDate: WEB_SEARCH_DATE_TEMPLATE
}

export const SystemPromptSectionsOverrideSchema = z.object({
  deferredTools: z.string().optional(),
  citations: z.string().optional(),
  webSearchDate: z.string().optional()
})
export type SystemPromptSectionsOverride = z.infer<typeof SystemPromptSectionsOverrideSchema>
