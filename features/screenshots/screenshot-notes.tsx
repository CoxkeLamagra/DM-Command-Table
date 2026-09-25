"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Images } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Screenshot } from "@/lib/api/screenshot-client";
import {
  RichTextContent,
  RichTextEditor,
} from "@/features/rich-text/rich-text";
import { appendScreenshotToken, parseScreenshotNotes } from "./tokens";

export function ScreenshotNotes({
  value,
  onChange,
  screenshots,
  upload,
  placeholder,
  className = "min-h-40",
}: {
  value: string;
  onChange: (value: string) => void;
  screenshots: Screenshot[];
  upload: (file: File) => Promise<Screenshot>;
  placeholder?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  function insert(record: Screenshot) {
    onChange(appendScreenshotToken(value, record.id));
    setLibraryOpen(false);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      insert(await upload(file));
      toast.success("Screenshot uploaded and added to notes");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Screenshot could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <RichTextEditor
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/15 bg-transparent"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <ImagePlus /> {uploading ? "Uploading…" : "Upload screenshot"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/15 bg-transparent"
          onClick={() => setLibraryOpen(true)}
        >
          <Images /> Screenshot library
        </Button>
        <input
          ref={input}
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {value && <NoteContent value={value} screenshots={screenshots} className="mt-4" />}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto border-amber-300/20 bg-[#12161e] text-stone-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-amber-100">
              Add screenshot from library
            </DialogTitle>
          </DialogHeader>
          {screenshots.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {screenshots.map((screenshot) => (
                <button
                  key={screenshot.id}
                  type="button"
                  onClick={() => insert(screenshot)}
                  className="overflow-hidden rounded-lg border border-white/10 bg-black/20 text-left transition hover:border-amber-300/40"
                >
                  <Image
                    src={screenshot.url}
                    alt={screenshot.name}
                    width={640}
                    height={360}
                    unoptimized
                    className="h-36 w-full object-contain bg-black/30"
                  />
                  <p className="truncate px-3 py-2 text-xs text-stone-300">{screenshot.name}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-stone-500">
              No screenshots have been uploaded yet.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NoteContent({
  value,
  screenshots,
  className = "",
}: {
  value: string;
  screenshots: Screenshot[];
  className?: string;
}) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const records = new Map(screenshots.map((record) => [record.id, record]));
  const parts = parseScreenshotNotes(value);
  return (
    <div className={`space-y-3 text-sm leading-7 text-stone-300 ${className}`}>
      {parts.map((part, index) => {
        if ("text" in part)
          return part.text.trim() ? (
            <RichTextContent key={index} value={part.text.trim()} />
          ) : null;
        const screenshot = records.get(part.screenshotId);
        const imageKey = `${part.screenshotId}-${index}`;
        const expanded = expandedImage === imageKey;
        return screenshot ? (
          <figure
            key={imageKey}
            className={`overflow-hidden rounded-lg border border-white/10 bg-black/20 p-2 transition-all ${expanded ? "w-full" : "w-fit max-w-full"}`}
          >
            <button
              type="button"
              className={`block max-w-full cursor-zoom-in overflow-hidden rounded bg-black/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ${expanded ? "w-full cursor-zoom-out" : "w-auto"}`}
              onClick={(event) => {
                event.stopPropagation();
                setExpandedImage((current) =>
                  current === imageKey ? null : imageKey,
                );
              }}
              aria-label={`${expanded ? "Reduce" : "Enlarge"} ${screenshot.name}`}
              aria-expanded={expanded}
            >
              <Image
                src={screenshot.url}
                alt={screenshot.name}
                width={1600}
                height={900}
                unoptimized
                className={
                  expanded
                    ? "max-h-[70vh] h-auto w-full object-contain"
                    : "h-32 w-auto max-w-full object-contain sm:h-40"
                }
              />
            </button>
            <figcaption className="px-1 pt-2 text-xs text-stone-500">{screenshot.name}</figcaption>
          </figure>
        ) : (
          <p key={`${part.screenshotId}-${index}`} className="rounded border border-dashed border-red-300/20 p-3 text-xs text-red-200/70">
            Screenshot unavailable
          </p>
        );
      })}
    </div>
  );
}
