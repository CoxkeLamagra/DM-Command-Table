"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Bold as BoldIcon,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";

const ALLOWED_TAGS = new Set([
  "B",
  "BR",
  "DIV",
  "EM",
  "FONT",
  "I",
  "LI",
  "OL",
  "P",
  "SPAN",
  "STRONG",
  "U",
  "UL",
]);
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i;

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className = "min-h-28",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useRef<HTMLDivElement | null>(null);
  const savedSelection = useRef<Range | null>(null);
  const [color, setColor] = useState("#fbbf24");

  useEffect(() => {
    const element = editor.current;
    if (!element || document.activeElement === element) return;
    const html = editableHtml(value);
    if (element.innerHTML !== html) element.innerHTML = html;
  }, [value]);

  function run(command: string, argument?: string) {
    editor.current?.focus();
    const selection = document.getSelection();
    if (selection && savedSelection.current) {
      selection.removeAllRanges();
      selection.addRange(savedSelection.current);
    }
    document.execCommand(command, false, argument);
    if (editor.current) onChange(editor.current.innerHTML);
  }

  function rememberSelection() {
    const selection = document.getSelection();
    if (
      selection?.rangeCount &&
      editor.current?.contains(selection.anchorNode)
    )
      savedSelection.current = selection.getRangeAt(0).cloneRange();
  }

  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-black/20">
      <div
        className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/20 p-1.5"
        role="toolbar"
        aria-label="Text formatting"
      >
        <FormatButton label="Bold" onRun={() => run("bold")}>
          <BoldIcon />
        </FormatButton>
        <FormatButton label="Italic" onRun={() => run("italic")}>
          <Italic />
        </FormatButton>
        <FormatButton label="Underline" onRun={() => run("underline")}>
          <Underline />
        </FormatButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <FormatButton
          label="Bulleted list"
          onRun={() => run("insertUnorderedList")}
        >
          <List />
        </FormatButton>
        <FormatButton
          label="Numbered list"
          onRun={() => run("insertOrderedList")}
        >
          <ListOrdered />
        </FormatButton>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-xs text-stone-400 hover:bg-white/5 hover:text-stone-200">
          <span>Color</span>
          <input
            type="color"
            value={color}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            aria-label="Text color"
            onChange={(event) => {
              setColor(event.target.value);
              run("foreColor", event.target.value);
            }}
          />
        </label>
        <FormatButton
          label="Clear formatting"
          onRun={() => run("removeFormat")}
        >
          <RemoveFormatting />
        </FormatButton>
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Rich text"}
        data-placeholder={placeholder ?? ""}
        className={`${className} overflow-y-auto px-3 py-2 text-sm leading-7 text-stone-200 outline-none empty:before:pointer-events-none empty:before:text-stone-600 empty:before:content-[attr(data-placeholder)] [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc`}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onBlur={(event) => {
          const safe = sanitizeRichText(event.currentTarget.innerHTML);
          if (safe !== event.currentTarget.innerHTML)
            event.currentTarget.innerHTML = safe;
          if (safe !== value) onChange(safe);
        }}
      />
    </div>
  );
}

export function RichTextContent({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const html = hydrated ? sanitizeRichText(editableHtml(value)) : "";
  if (!html) return null;
  return (
    <div
      className={`rich-text text-sm leading-7 text-stone-300 [&_ol]:ml-6 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:ml-6 [&_ul]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function emptySubscribe() {
  return () => undefined;
}

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

function FormatButton({
  label,
  onRun,
  children,
}: {
  label: string;
  onRun: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded text-stone-400 hover:bg-white/5 hover:text-stone-100 [&_svg]:size-4"
      onMouseDown={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      {children}
    </button>
  );
}

function editableHtml(value: string): string {
  if (!value) return "";
  if (
    /<\/?[a-z][^>]*>/i.test(value) ||
    /&(?:amp|gt|lt|nbsp|quot|#0?39|#\d+|#x[0-9a-f]+);/i.test(value)
  )
    return value;
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function sanitizeRichText(value: string): string {
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  for (const element of Array.from(documentValue.body.querySelectorAll("*"))) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    const color =
      (element as HTMLElement).style.color || element.getAttribute("color") || "";
    for (const attribute of Array.from(element.attributes))
      element.removeAttribute(attribute.name);
    if (color && SAFE_COLOR.test(color))
      (element as HTMLElement).style.color = color;
  }
  return documentValue.body.innerHTML;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
