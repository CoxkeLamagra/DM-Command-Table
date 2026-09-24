import type { LocalUser } from "@/server/auth/credentials";
import { getLocalUser } from "@/server/auth/sessions";

export async function authorizeRequest(options: { admin?: boolean } = {}) {
  const user = await getLocalUser();
  if (!user) {
    return {
      response: Response.json({ error: "Sign in required." }, { status: 401 }),
    } as const;
  }
  if (options.admin && !user.isAdmin) {
    return {
      response: Response.json(
        { error: "Administrator access required." },
        { status: 403 },
      ),
    } as const;
  }
  return { user } as { user: LocalUser };
}

export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!requestHost) return invalidOrigin();
  try {
    return new URL(origin).host === requestHost ? null : invalidOrigin();
  } catch {
    return invalidOrigin();
  }
}

export async function readJson<T>(request: Request): Promise<T | null> {
  return request.json().catch(() => null) as Promise<T | null>;
}

function invalidOrigin(): Response {
  return Response.json({ error: "Invalid request origin." }, { status: 403 });
}
