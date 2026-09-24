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
  const response = await fetch("/api/screenshots", { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    screenshots?: Screenshot[];
    error?: string;
  };
  if (!response.ok || !body.screenshots)
    throw new Error(body.error ?? "Screenshots could not be loaded.");
  return body.screenshots;
}

export async function uploadScreenshot(file: File): Promise<Screenshot> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/screenshots", { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as {
    screenshot?: Screenshot;
    error?: string;
  };
  if (!response.ok || !body.screenshot)
    throw new Error(body.error ?? "Screenshot could not be uploaded.");
  return body.screenshot;
}

export async function deleteScreenshot(id: string): Promise<void> {
  const response = await fetch(`/api/screenshots/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Screenshot could not be deleted.");
}
