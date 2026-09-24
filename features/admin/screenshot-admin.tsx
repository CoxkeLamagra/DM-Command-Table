"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useScreenshotLibrary } from "@/features/screenshots/use-screenshot-library";
import { deleteScreenshot } from "@/lib/api/screenshot-client";

export function ScreenshotAdmin() {
  const input = useRef<HTMLInputElement | null>(null);
  const { screenshots, setScreenshots, loading, upload } = useScreenshotLibrary();
  const [working, setWorking] = useState("");

  async function add(file: File) {
    setWorking("upload");
    try {
      await upload(file);
      toast.success("Screenshot added to the library");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Screenshot could not be uploaded.");
    } finally {
      setWorking("");
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? It will no longer appear in notes that reference it.`)) return;
    setWorking(id);
    try {
      await deleteScreenshot(id);
      setScreenshots((current) => current.filter((record) => record.id !== id));
      toast.success("Screenshot deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Screenshot could not be deleted.");
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300/70">
            Media library
          </p>
          <h2 className="mt-1 font-serif text-2xl text-stone-100">Uploaded screenshots</h2>
          <p className="mt-2 text-sm text-stone-500">
            Images deleted here become unavailable anywhere they are embedded in notes.
          </p>
        </div>
        <Button
          className="bg-amber-300 text-black hover:bg-amber-200"
          disabled={working === "upload"}
          onClick={() => input.current?.click()}
        >
          <ImagePlus /> {working === "upload" ? "Uploading…" : "Add screenshot"}
        </Button>
        <input
          ref={input}
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void add(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {loading ? (
        <p className="text-sm text-stone-400">Loading screenshots…</p>
      ) : screenshots.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {screenshots.map((screenshot) => (
            <article key={screenshot.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#12161e]">
              <Image
                src={screenshot.url}
                alt={screenshot.name}
                width={800}
                height={450}
                unoptimized
                className="h-48 w-full object-contain bg-black/30"
              />
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-200">{screenshot.name}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatBytes(screenshot.size)} · {screenshot.uploadedBy}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-red-300 hover:text-red-200"
                  disabled={working === screenshot.id}
                  onClick={() => void remove(screenshot.id, screenshot.name)}
                  aria-label={`Delete ${screenshot.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-stone-500">
          No screenshots have been uploaded yet.
        </p>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
