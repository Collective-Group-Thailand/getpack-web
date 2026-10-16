/**
 * "Ask CS" on LINE with the configuration already written out (F3 3.2).
 *
 * LINE's documented deep link `https://line.me/R/oaMessage/{basic id}/?{text}` opens a chat with
 * the Official Account and pre-fills the message; the customer still presses send. The account
 * id is getpack's own (D-005), read from `store.support-channels`, never hard-coded.
 */

/** LINE caps a pre-filled message; keep well inside it so the link always opens. */
const MAX_TEXT = 900;

export function lineChatUrl(lineOaId: string, text: string): string {
  const trimmed = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
  return `https://line.me/R/oaMessage/${encodeURIComponent(lineOaId)}/?${encodeURIComponent(trimmed)}`;
}

/** The message: what the customer is looking at, one fact per line, then a link back to it. */
export function configurationSummary(title: string, facts: { label: string; value: string }[], link?: string): string {
  return [title, ...facts.map((fact) => `• ${fact.label}: ${fact.value}`), ...(link ? [link] : [])].join("\n");
}
