const SCREENSHOT_PATTERN = /\[\[screenshot:([a-f0-9-]+)\]\]/gi;

export type NotePart = { text: string } | { screenshotId: string };

export function screenshotToken(id: string): string {
  return `[[screenshot:${id}]]`;
}

export function appendScreenshotToken(value: string, id: string): string {
  const token = screenshotToken(id);
  return value ? `${value.replace(/\s+$/, "")}\n${token}` : token;
}

export function parseScreenshotNotes(value: string): NotePart[] {
  const parts: NotePart[] = [];
  let cursor = 0;
  for (const match of value.matchAll(SCREENSHOT_PATTERN)) {
    if (match.index > cursor) parts.push({ text: value.slice(cursor, match.index) });
    parts.push({ screenshotId: match[1] });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor) });
  return parts;
}
