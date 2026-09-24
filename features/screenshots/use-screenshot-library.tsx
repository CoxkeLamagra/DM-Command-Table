"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  fetchScreenshots,
  uploadScreenshot,
  type Screenshot,
} from "@/lib/api/screenshot-client";

type ScreenshotLibrary = {
  screenshots: Screenshot[];
  setScreenshots: Dispatch<SetStateAction<Screenshot[]>>;
  loading: boolean;
  refresh: () => Promise<Screenshot[]>;
  upload: (file: File) => Promise<Screenshot>;
};

const ScreenshotLibraryContext = createContext<ScreenshotLibrary | null>(null);

export function ScreenshotLibraryProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    () => ({ screenshots, setScreenshots, loading, refresh, upload }),
    [screenshots, loading, refresh, upload],
  );
  return (
    <ScreenshotLibraryContext.Provider value={value}>
      {children}
    </ScreenshotLibraryContext.Provider>
  );
}

export function useScreenshotLibrary(): ScreenshotLibrary {
  const library = useContext(ScreenshotLibraryContext);
  if (!library)
    throw new Error("ScreenshotLibraryProvider is required.");
  return library;
}
