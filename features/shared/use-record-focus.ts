"use client";
import { useEffect } from "react";

export function useRecordFocus(elementId: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!elementId || !ready) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(elementId);
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [elementId, ready]);
}
