"use client";

import type { ReactNode } from "react";
import { CircleDot } from "lucide-react";
import { TabsTrigger } from "@/components/ui/tabs";

export function NavigationItem({
  value,
  icon,
  children,
}: {
  value: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 flex-none justify-start gap-3 rounded-lg px-3 py-2 text-stone-400 after:hidden data-[state=active]:bg-amber-300/10 data-[state=active]:text-amber-200 [&_svg]:size-4"
    >
      {icon}
      {children}
    </TabsTrigger>
  );
}

export function ScreenTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300/70">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-black/25 p-2">
      <p className="text-[10px] uppercase tracking-wider text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-stone-200">{value}</p>
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-2 border-t border-white/10 pt-4">
      <h3 className="mb-2 flex items-center gap-2 font-serif text-lg text-amber-200">
        <CircleDot size={14} />
        {title}
      </h3>
      <div className="whitespace-pre-line text-sm leading-7 text-stone-300">
        {children}
      </div>
    </section>
  );
}
