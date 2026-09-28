"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchField({
  id,
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const listId = `${id}-suggestions`;
  return (
    <div className="relative mb-5 max-w-2xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
      <Input
        id={id}
        type="search"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="border-white/10 bg-black/20 pl-9 pr-10"
        autoComplete="off"
      />
      {value && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X />
        </Button>
      )}
      <datalist id={listId}>
        {[...new Set(suggestions)].map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
}
