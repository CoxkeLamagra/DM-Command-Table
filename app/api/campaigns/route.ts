import { getLocalUser } from "@/server/auth/sessions";
import {
  connectPendingMemberships,
  createCampaign,
  deleteCampaign,
  getCampaignAccess,
  listCampaigns,
  shareCampaign,
  updateCampaign,
} from "@/server/campaigns/repository";
import {
  isCampaignPayloadTooLarge,
  normaliseCampaignName,
  normaliseUpdatedCampaignName,
} from "@/server/campaigns/validation";
import { parseCampaignState } from "@/features/campaign/schema";
import { ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const user = await getLocalUser();
  if (user) connectPendingMemberships(user);
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return authenticationRequired();
  return Response.json({
    user: {
      username: user.username,
      displayName: user.displayName,
      isAdmin: Boolean(user.isAdmin),
    },
    campaigns: listCampaigns(user.userId),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return authenticationRequired();
  const body = (await request.json()) as {
    action?: string;
    id?: string;
    name?: string;
    payload?: unknown;
    username?: string;
    role?: string;
  };

  if (body.action === "share") {
    if (!body.id || !body.username || !isShareRole(body.role)) {
      return Response.json(
        { error: "Campaign, username and role are required." },
        { status: 400 },
      );
    }
    if (getCampaignAccess(body.id, user.userId) !== "owner") {
      return Response.json(
        { error: "Only the owner can share this campaign." },
        { status: 403 },
      );
    }
    if (!shareCampaign(body.id, body.username, body.role)) {
      return Response.json(
        { error: "No local account exists with that username." },
        { status: 404 },
      );
    }
    return Response.json({ shared: true });
  }

  if (isCampaignPayloadTooLarge(body.payload)) {
    return Response.json(
      { error: "Campaign data is too large." },
      { status: 413 },
    );
  }
  try {
    const payload = parseCampaignState(body.payload);
    const name = normaliseCampaignName(body.name, "New campaign");
    return Response.json(createCampaign(user.userId, name, payload));
  } catch (error) {
    return invalidCampaign(error);
  }
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return authenticationRequired();
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    payload?: unknown;
  };
  if (!body.id) {
    return Response.json(
      { error: "Campaign id is required." },
      { status: 400 },
    );
  }
  const role = getCampaignAccess(body.id, user.userId);
  if (role !== "owner" && role !== "editor") {
    return Response.json(
      { error: "This campaign is read-only." },
      { status: 403 },
    );
  }
  if (isCampaignPayloadTooLarge(body.payload)) {
    return Response.json(
      { error: "Campaign data is too large." },
      { status: 413 },
    );
  }
  try {
    const payload = parseCampaignState(body.payload);
    const updatedAt = updateCampaign(
      body.id,
      normaliseUpdatedCampaignName(body.name),
      payload,
    );
    return Response.json({ saved: true, updatedAt });
  } catch (error) {
    return invalidCampaign(error);
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return authenticationRequired();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json(
      { error: "Campaign id is required." },
      { status: 400 },
    );
  }
  if (getCampaignAccess(id, user.userId) !== "owner") {
    return Response.json(
      { error: "Only the owner can delete this campaign." },
      { status: 403 },
    );
  }
  deleteCampaign(id);
  return Response.json({ deleted: true });
}

function authenticationRequired() {
  return Response.json({ error: "Authentication required." }, { status: 401 });
}

function isShareRole(role: string | undefined): role is "viewer" | "editor" {
  return role === "viewer" || role === "editor";
}

function invalidCampaign(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "Campaign data does not match the current format." },
      { status: 400 },
    );
  }
  throw error;
}
