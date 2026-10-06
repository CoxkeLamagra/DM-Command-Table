export const RICH_TEXT_TAGS = [
  "b",
  "br",
  "div",
  "em",
  "font",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
] as const;

export function safeColorPatterns(): RegExp[] {
  return [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i];
}

export function isSafeColor(value: string): boolean {
  return safeColorPatterns().some((pattern) => pattern.test(value));
}
