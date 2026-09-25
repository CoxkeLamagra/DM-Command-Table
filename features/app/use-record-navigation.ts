"use client";

import { useEffect, useState } from "react";

export function useRecordNavigation() {
  const [activeTab, setActiveTab] = useState("campaign");
  const [target, setTarget] = useState<{ tab: "sessions" | "story"; id: string } | null>(null);

  useEffect(() => {
    if (!target || activeTab !== target.tab) return;
    const frame = requestAnimationFrame(() => {
      const prefix = target.tab === "sessions" ? "session" : "story";
      const entry = document.getElementById(`${prefix}-${target.id}`);
      entry?.scrollIntoView({ behavior: "smooth", block: "center" });
      entry?.focus({ preventScroll: true });
      setTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, target]);

  function open(tab: "sessions" | "story", id: string) {
    setTarget({ tab, id });
    setActiveTab(tab);
  }

  return { activeTab, setActiveTab, openSession: (id: string) => open("sessions", id), openStory: (id: string) => open("story", id) };
}
