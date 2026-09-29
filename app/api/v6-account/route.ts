import { z } from "zod";
import { getV6Database } from "@/db/v6-sqlite";
import { rejectCrossOrigin } from "@/server/http/origin";
import { changeV6Password, renameV6Account } from "@/server/v6/accounts";
import { createV6Session, getV6User } from "@/server/v6/auth";
import { apiError, apiJson, jsonBody } from "@/server/v6/http";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("rename"), username: z.string(), displayName: z.string().optional() }), z.object({ action: z.literal("change-password"), currentPassword: z.string(), newPassword: z.string() })]);
export async function PATCH(request: Request) { const origin = rejectCrossOrigin(request); if (origin) return origin; try { const database = getV6Database(); const user = await getV6User(database); if (!user) return apiJson({ error: "Authentication required." }, 401); const input = schema.parse(await jsonBody(request)); if (input.action === "rename") renameV6Account(database, user.userId, input.username, input.displayName); else { changeV6Password(database, user.userId, input.currentPassword, input.newPassword); await createV6Session(user.userId, database); } return apiJson({ changed: true }); } catch (error) { return apiError(error); } }
