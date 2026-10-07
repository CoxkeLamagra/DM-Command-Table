"use client";
import { useEffect, useId } from "react";
const dirtyEditors = new Set<string>();
export function confirmDiscardChanges(): boolean {
  return (
    dirtyEditors.size === 0 ||
    window.confirm(
      "You have unsaved changes. Leave this screen and discard them?",
    )
  );
}
export function useUnsavedChanges(dirty: boolean) {
  const id = useId();
  useEffect(() => {
    if (dirty) dirtyEditors.add(id);
    else dirtyEditors.delete(id);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      dirtyEditors.delete(id);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, id]);
}
