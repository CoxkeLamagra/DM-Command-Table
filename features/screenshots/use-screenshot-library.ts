"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchScreenshots,
  uploadScreenshot,
  type Screenshot,
} from "@/lib/api/screenshot-client";

export function useScreenshotLibrary() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const records = await fetchScreenshots();
    setScreenshots(records);
    setLoading(false);
    return records;
  }, []);

  useEffect(() => {
    // Initial hydration intentionally synchronizes with the local screenshot API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setLoading(false));
  }, [refresh]);

  const upload = useCallback(async (file: File) => {
    const record = await uploadScreenshot(file);
    setScreenshots((current) => [record, ...current]);
    return record;
  }, []);

  return { screenshots, setScreenshots, loading, refresh, upload };
}
