export type Screenshot = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  url: string;
};

export async function fetchScreenshots(): Promise<Screenshot[]> {
  const body = await requestJson<{
    screenshots?: Screenshot[];
  }>("/api/screenshots", { cache: "no-store" }, {
    fallback: "Screenshots could not be loaded.",
  });
  if (!body.screenshots) throw new Error("Screenshots could not be loaded.");
  return body.screenshots;
}

export async function uploadScreenshot(file: File): Promise<Screenshot> {
  const form = new FormData();
  form.set("file", file);
  const body = await requestJson<{
    screenshot?: Screenshot;
  }>("/api/screenshots", { method: "POST", body: form }, {
    fallback: "Screenshot could not be uploaded.",
  });
  if (!body.screenshot) throw new Error("Screenshot could not be uploaded.");
  return body.screenshot;
}

export async function deleteScreenshot(id: string): Promise<void> {
  await requestJson(
    `/api/screenshots/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    { fallback: "Screenshot could not be deleted." },
  );
}
import { requestJson } from "./http-client";
