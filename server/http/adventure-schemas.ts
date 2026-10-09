import { z } from "zod";
const ids = z
  .array(z.string().uuid())
  .max(500)
  .refine(
    (values) => new Set(values).size === values.length,
    "Selections must be unique",
  );
export const sceneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(100000),
  essential: z.boolean(),
  minutes: z.number().int().min(0).max(1440),
  done: z.boolean(),
});
export const adventureSchema = z.object({
  threads: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        kind: z.enum(["promise", "clue", "consequence", "objective"]),
        status: z.enum(["open", "resolved"]),
        notes: z.string().max(100000),
      }),
    )
    .max(500)
    .refine(
      (values) =>
        new Set(values.map((value) => value.id)).size === values.length,
      "Thread IDs must be unique",
    ),
  partyPresets: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        playerIds: ids,
      }),
    )
    .max(50)
    .refine(
      (values) =>
        new Set(values.map((value) => value.id)).size === values.length,
      "Preset IDs must be unique",
    ),
  oneShot: z
    .object({ durationMinutes: z.number().int().min(15).max(1440) })
    .nullable(),
});
export const continuitySchema = z.object({
  recap: z.string().max(1000000),
  rewards: z.string().max(1000000),
  scenes: z
    .array(sceneSchema)
    .max(100)
    .refine(
      (values) =>
        new Set(values.map((value) => value.id)).size === values.length,
      "Scene IDs must be unique",
    ),
  threadIds: ids,
  attendanceIds: ids,
});
export const carrySchema = z.object({
  revision: z.number().int().positive(),
  campaignRevision: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  date: z.string().max(40),
  sceneIds: ids,
  threadIds: ids,
});
export const quickStartSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(15).max(1440),
  sourceCampaignId: z.string().uuid().optional(),
  sourceRevision: z.number().int().positive().optional(),
  presetId: z.string().uuid().optional(),
  scenes: z.array(sceneSchema).min(1).max(100),
});
