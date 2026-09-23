import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type Role = "owner" | "editor" | "viewer";

async function currentUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, email, display_name, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at"
  ).bind(user.userId, user.email.toLowerCase(), user.displayName, now).run();
  await env.DB.prepare(
    "UPDATE campaign_members SET user_id = ? WHERE user_id IS NULL AND invite_email = ?"
  ).bind(user.userId, user.email.toLowerCase()).run();
  return user;
}

async function access(campaignId: string, userId: string): Promise<Role | null> {
  const row = await env.DB.prepare(
    "SELECT CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role FROM campaigns c LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ? WHERE c.id = ? AND (c.owner_id = ? OR m.user_id = ?) LIMIT 1"
  ).bind(userId, userId, campaignId, userId, userId).first<{ role: Role }>();
  return row?.role ?? null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const owned = await env.DB.prepare("SELECT COUNT(*) AS count FROM campaigns WHERE owner_id = ?").bind(user.userId).first<{ count: number }>();
  const knownUsers = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if ((owned?.count ?? 0) === 0 && knownUsers?.count === 1) {
    const legacy = await env.DB.prepare("SELECT payload, updated_at AS updatedAt FROM campaign_states WHERE id = 'main-campaign' LIMIT 1").first<{ payload: string; updatedAt: number }>();
    if (legacy) {
      const parsed = JSON.parse(legacy.payload) as { campaignName?: string };
      const now = legacy.updatedAt || Date.now();
      await env.DB.prepare(
        "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(crypto.randomUUID(), user.userId, parsed.campaignName ?? "Imported campaign", legacy.payload, now, now).run();
    }
  }
  const rows = await env.DB.prepare(
    `SELECT c.id, c.name, c.payload, c.updated_at AS updatedAt,
      CASE WHEN c.owner_id = ? THEN 'owner' ELSE m.role END AS role,
      CASE WHEN EXISTS(SELECT 1 FROM campaign_members x WHERE x.campaign_id = c.id) THEN 1 ELSE 0 END AS shared
     FROM campaigns c
     LEFT JOIN campaign_members m ON m.campaign_id = c.id AND m.user_id = ?
     WHERE c.owner_id = ? OR m.user_id = ?
     ORDER BY c.updated_at DESC`
  ).bind(user.userId, user.userId, user.userId, user.userId).all<{
    id: string; name: string; payload: string; updatedAt: number; role: Role; shared: number;
  }>();
  return Response.json({
    user: { email: user.email, displayName: user.displayName },
    campaigns: rows.results.map(row => ({
      ...row,
      payload: JSON.parse(row.payload),
      updatedAt: new Date(row.updatedAt).toISOString(),
      shared: Boolean(row.shared),
    })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json() as { action?: string; id?: string; name?: string; payload?: unknown; email?: string; role?: string };
  if (body.action === "share") {
    if (!body.id || !body.email || !["viewer", "editor"].includes(body.role ?? "")) {
      return Response.json({ error: "Campaign, email and role are required." }, { status: 400 });
    }
    if (await access(body.id, user.userId) !== "owner") {
      return Response.json({ error: "Only the owner can share this campaign." }, { status: 403 });
    }
    const email = body.email.trim().toLowerCase();
    const known = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first<{ id: string }>();
    await env.DB.prepare(
      "INSERT INTO campaign_members (campaign_id, user_id, invite_email, role, added_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(campaign_id, invite_email) DO UPDATE SET user_id = excluded.user_id, role = excluded.role"
    ).bind(body.id, known?.id ?? null, email, body.role, Date.now()).run();
    return Response.json({ shared: true });
  }
  const id = crypto.randomUUID();
  const name = (body.name ?? "New campaign").trim().slice(0, 120) || "New campaign";
  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 1_500_000) return Response.json({ error: "Campaign data is too large." }, { status: 413 });
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO campaigns (id, owner_id, name, payload, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, user.userId, name, payload, now, now).run();
  return Response.json({ id, name, payload: body.payload, role: "owner", shared: false, updatedAt: new Date(now).toISOString() });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json() as { id?: string; name?: string; payload?: unknown };
  if (!body.id) return Response.json({ error: "Campaign id is required." }, { status: 400 });
  const role = await access(body.id, user.userId);
  if (role !== "owner" && role !== "editor") return Response.json({ error: "This campaign is read-only." }, { status: 403 });
  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 1_500_000) return Response.json({ error: "Campaign data is too large." }, { status: 413 });
  const now = Date.now();
  await env.DB.prepare("UPDATE campaigns SET name = ?, payload = ?, updated_at = ? WHERE id = ?")
    .bind((body.name ?? "Campaign").slice(0, 120), payload, now, body.id).run();
  return Response.json({ saved: true, updatedAt: new Date(now).toISOString() });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Campaign id is required." }, { status: 400 });
  if (await access(id, user.userId) !== "owner") return Response.json({ error: "Only the owner can delete this campaign." }, { status: 403 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM campaign_members WHERE campaign_id = ?").bind(id),
    env.DB.prepare("DELETE FROM campaigns WHERE id = ?").bind(id),
  ]);
  return Response.json({ deleted: true });
}
