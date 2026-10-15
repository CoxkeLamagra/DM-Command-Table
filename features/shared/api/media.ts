import type { Screenshot } from "@/domain/types";
import { requestJson } from "./transport";
export async function uploadScreenshot(
  file: File,
  deduplicateToken = false,
): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  if (deduplicateToken) form.set("deduplicateToken", "true");
  return (
    await requestJson<{ screenshot: { url: string } }>("/api/screenshots", {
      method: "POST",
      body: form,
    })
  ).screenshot.url;
}

export async function listScreenshots(): Promise<Screenshot[]> {
  return (await requestJson<{ screenshots: Screenshot[] }>("/api/screenshots"))
    .screenshots;
}

export async function deleteScreenshot(id: string): Promise<void> {
  await requestJson(`/api/screenshots/${id}`, { method: "DELETE" });
}
