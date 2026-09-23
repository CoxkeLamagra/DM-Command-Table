import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { campaignStates } from "../../../db/schema";

const STATE_ID = "main-campaign";

export async function GET() {
  try {
    const [row] = await getDb().select().from(campaignStates).where(eq(campaignStates.id, STATE_ID)).limit(1);
    return Response.json({ state: row ? JSON.parse(row.payload) : null, updatedAt: row?.updatedAt ?? null });
  } catch (error) {
    console.error("Unable to load campaign state", error);
    return Response.json({ error: "Your campaign could not be loaded. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const state = await request.json();
    if (!state || typeof state !== "object") return Response.json({ error: "Invalid campaign data." }, { status: 400 });
    const payload = JSON.stringify(state);
    if (payload.length > 1_500_000) return Response.json({ error: "Campaign data is too large." }, { status: 413 });
    const now = new Date();
    await getDb().insert(campaignStates).values({ id: STATE_ID, payload, updatedAt: now })
      .onConflictDoUpdate({ target: campaignStates.id, set: { payload, updatedAt: now } });
    return Response.json({ saved: true, updatedAt: now.toISOString() });
  } catch (error) {
    console.error("Unable to save campaign state", error);
    return Response.json({ error: "Your changes could not be saved. Please try again." }, { status: 500 });
  }
}
