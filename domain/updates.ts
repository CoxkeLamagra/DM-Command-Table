export type UpdateJob = {
  id: string;
  status: "running" | "succeeded" | "failed" | "interrupted";
  target: string;
  actor: string;
  startedAt: number;
  finishedAt: number | null;
  exitCode: number | null;
  log: string;
  steps: { id: string; status: "running" | "succeeded" | "failed" }[];
};
export type UpdateState = {
  available: boolean;
  target?: string;
  job: UpdateJob | null;
};
