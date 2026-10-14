/** Local images always use the authenticated media route; external URLs never persist. */
export function isLocalMediaUrl(value: string): boolean {
  return /^\/api\/screenshots\/[0-9a-f-]+$/i.test(value);
}
export function extractLocalImageIds(value: string): string[] {
  return [
    ...value.matchAll(
      /<img\b[^>]*\bsrc=["']\/api\/screenshots\/([0-9a-f-]+)["'][^>]*>/gi,
    ),
  ].map((match) => match[1]);
}
