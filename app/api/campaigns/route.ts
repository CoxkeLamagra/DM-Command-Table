import { getDatabase } from "@/db/sqlite";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "owner" | "editor" | "viewer";
type CountRow = { count: number };
type IdRow = { id: string };
type AccessRow = { role: Role };
type LegacyRow = { payload: string; updatedAt: number };
type CampaignRow = {
  id: string;
  name: string;
  payload: string;
  updatedAt: number;
  role: Role;
  shared: number;
};

async function currentUser() {
  const user = await getChatGPTUser();
  if (!user) return null;

  const db = getDatabase();
  const now = Date.now();
  db.prepare(
    "INSERT INTO users (id, email, display_name, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at",
  ).run(user.userId, user.email.toLowerCase(), user.displayName, now);
  db.prepare(
    "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?",
  ).run(user.userId, user.email.toLowerCase());

  return user;
}

function access(campaignId: string, userId: string): Role | null {
  const row = getDatabase().prepare(
    "SELECT CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role FROM campaigns c LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ? WHERE c.id = ? AND (c.owner_id = ? OR m.user_id = ?) LIMIT 1",
  ).get(userId, userId, campaignId, userId, userId) as AccessRow | undefined;
  return row?.role ?? null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const db = getDatabase();
  const owned = db.prepare(
    "SELECT COUNT(*) AS count FROM campaigns WHERE owner_id = ?",
  ).get(user.userId) as CountRow;
  const knownUsers = db.prepare(
    "SELECT COUNT(*) AS count FROM users",
  ).get() as CountRow;

  if (owned.count === 0 && knownUsers.count === 1) {
    const legacy = db.prepare(
      "SELECT payload, updated_at AS updatedAt FROM campaign_states WHERE id = 'main-campaign' LIMIT 1",
    ).get() as LegacyRow | undefined;
    if (legacy) {
      const parsed = JSON.parse(legacy.payload) as { campaignName?: string };
      const now = legacy.updatedAt || Date.now();
      db.prepare(
        "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        crypto.randomUUID(),
        user.userId,
        parsed.campaignName ?? "Imported campaign",
        legacy.payload,
        now,
        now,
      );
    }
  }

  const rows = db.prepare(
    `SELECT c.id, c.name, c.payload, c.updated_at AS updatedAt,
      CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role,
      CASE WHEN EXISTS(SELECT 1 FROM campaign_members x WHERE x.campaign_id = c.id) THEN 1 ELSE 0 END AS shared
     FROM campaigns c
     LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ?
     WHERE c.owner_id = ? OR m.user_id = ?
     ORDER BY c.updated_at DESC`,
  ).all(user.userId, user.userId, user.userId, user.userId) as CampaignRow[];

  return Response.json({
    user: { email: user.email, displayName: user.displayName },
    campaigns: rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload),
      updatedAt: new Date(row.updatedAt).toISOString(),
      shared: Boolean(row.shared),
    })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json() as {
    action?: string;
    id?: string;
    name?: string;
    payload?: unknown;
    email?: string;
    role?: string;
  };

  if (body.action === "share") {
    if (!body.id || !body.email || !["viewer", "editor"].includes(body.role ?? "")) {
      return Response.json(
        { error: "Campaign, email and role are required." },
        { status: 400 },
      );
    }
    if (access(body.id, user.userId) !== "owner") {
      return Response.json(
        { error: "Only the owner can share this campaign." },
        { status: 403 },
      );
    }

    const db = getDatabase();
    const email = body.email.trim().toLowerCase();
    const known = db.prepare(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
    ).get(email) as IdRow | undefined;
    db.prepare(
      "INSERT INTO campaign_members (campaign_id, user_id, invite_email, role, added_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(campaign_id, invite_email) DO UPDATE SET user_id = excluded.user_id, role = excluded.role",
    ).run(body.id, known?.id ?? null, email, body.role!, Date.now());
    return Response.json({ shared: true });
  }

  const id = crypto.randomUUID();
  const name = (body.name ?? "New campaign").trim().slice(0, 120) || "New campaign";
  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 1_500_000) {
    return Response.json({ error: "Campaign data is too large." }, { status: 413 });
  }

  const now = Date.now();
  getDatabase().prepare(
    "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, user.userId, name, payload, now, now);

  return Response.json({
    id,
    name,
    payload: body.payload,
    role: "owner",
    shared: false,
    updatedAt: new Date(now).toISOString(),
  });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json() as {
    id?: string;
    name?: string;
    payload?: unknown;
  };
  if (!body.id) {
    return Response.json({ error: "Campaign id is required." }, { status: 400 });
  }

  const role = access(body.id, user.userId);
  if (role !== "owner" && role !== "editor") {
    return Response.json({ error: "This campaign is read-only." }, { status: 403 });
  }

  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 1_500_000) {
    return Response.json({ error: "Campaign data is too large." }, { status: 413 });
  }

  const now = Date.now();
  getDatabase().prepare(
    "UPDATE campaigns SET name = ?, payload = ?, updated_at = ? WHERE id = ?",
  ).run((body.name ?? "Campaign").slice(0, 120), payload, now, body.id);
  return Response.json({ saved: true, updatedAt: new Date(now).toISOString() });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Campaign id is required." }, { status: 400 });
  }
  if (access(id, user.userId) !== "owner") {
    return Response.json(
      { error: "Only the owner can delete this campaign." },
      { status: 403 },
    );
  }

  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM campaign_members WHERE campaign_id = ?").run(id);
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return Response.json({ deleted: true });
}
