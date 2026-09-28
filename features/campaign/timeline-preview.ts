const SCREENSHOT_TOKEN = /\[\[screenshot:[a-f0-9-]+\]\]/gi;

export function createTimelinePreview(value: string, limit = 2_000) {
  const characters = [...value.replace(SCREENSHOT_TOKEN, "").trim()];
  return {
    text: characters.slice(0, limit).join(""),
    truncated: characters.length > limit,
  };
}
