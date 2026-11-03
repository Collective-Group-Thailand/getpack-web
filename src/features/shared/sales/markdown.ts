/**
 * The playbook's card bodies are short Markdown written by Marketing (PLAYBOOK.md): paragraphs, numbered and bulleted
 * lists, one simple table, **bold**. This reads exactly that into blocks the card renders as React elements — no
 * HTML string is ever injected, so a card cannot carry markup or script.
 */
export type Inline = { text: string; bold: boolean }[];
export type Block =
  | { kind: "paragraph"; inline: Inline }
  | { kind: "list"; ordered: boolean; items: Inline[] }
  | { kind: "table"; header: Inline[]; rows: Inline[][] };

export function inlineOf(text: string): Inline {
  const parts: Inline = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) parts.push({ text: text.slice(last, match.index), bold: false });
    parts.push({ text: match[1]!, bold: true });
    last = match.index! + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts.filter((part) => part.text.length > 0);
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => inlineOf(cell.trim()));

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const chunks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;
    if (lines.every((line) => line.trim().startsWith("|"))) {
      const body = lines.filter((line) => !/^[\s|:-]+$/.test(line));
      const [head, ...rows] = body;
      blocks.push({ kind: "table", header: head ? cells(head) : [], rows: rows.map(cells) });
      continue;
    }
    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      blocks.push({
        kind: "list",
        ordered: true,
        items: lines.map((line) => inlineOf(line.replace(/^\s*\d+\.\s+/, ""))),
      });
      continue;
    }
    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      blocks.push({
        kind: "list",
        ordered: false,
        items: lines.map((line) => inlineOf(line.replace(/^\s*[-*]\s+/, ""))),
      });
      continue;
    }
    blocks.push({ kind: "paragraph", inline: inlineOf(lines.join(" ")) });
  }
  return blocks;
}
