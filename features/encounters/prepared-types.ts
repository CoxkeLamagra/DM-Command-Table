import type { EncounterDraftController } from "./drafts";
export type PreparedEncountersProps = {
  campaignId: string;
  sessionId: string;
  editable: boolean;
  onOpenCombat: () => void;
  onDirtyChange?: (sessionId: string, dirty: boolean) => void;
  onCountChange?: (sessionId: string, count: number) => void;
  savingSession?: boolean;
  registerSave?: (
    sessionId: string,
    controller: EncounterDraftController,
  ) => () => void;
};
