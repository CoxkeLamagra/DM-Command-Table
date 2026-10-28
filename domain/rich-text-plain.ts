export function richTextToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:div|li|ol|p|ul)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
