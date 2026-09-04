import { NAMESPACES_VARIABLE, SYSTEM_PROMPT_SECTION_DEFAULTS } from '@shared/ai/systemPromptSections'

import type { ToolEntry } from '../../../tools/adapters/aiSdk/types'

/** `<namespaces>` inventory block, or '' when nothing is deferred. */
export function buildDeferredNamespacesBlock(deferredEntries: readonly ToolEntry[] = []): string {
  if (deferredEntries.length === 0) return ''
  const counts = new Map<string, number>()
  for (const entry of deferredEntries) {
    // Label, not `namespace` — MCP namespaces are opaque server ids.
    const label = entry.namespaceLabel ?? entry.namespace
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const lines = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ns, n]) => `  <namespace name="${ns}" count="${n}"/>`)
  return `<namespaces>\n${lines.join('\n')}\n</namespaces>`
}

/**
 * Fill `{{namespaces}}` in a deferred-tools template. With nothing deferred the
 * placeholder (and the blank line before it) is dropped, so the default renders
 * exactly as the pre-override implementation did.
 */
export function renderDeferredToolsSection(template: string, deferredEntries: readonly ToolEntry[] = []): string {
  const block = buildDeferredNamespacesBlock(deferredEntries)
  return block
    ? template.replace(NAMESPACES_VARIABLE, block)
    : template.replace(`\n\n${NAMESPACES_VARIABLE}`, '').replace(NAMESPACES_VARIABLE, '')
}

/** Cherry's default deferred-tools section with the live namespace inventory. */
export function getDeferredToolsSystemPrompt(deferredEntries: readonly ToolEntry[] = []): string {
  return renderDeferredToolsSection(SYSTEM_PROMPT_SECTION_DEFAULTS.deferredTools, deferredEntries)
}
