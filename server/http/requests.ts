import type { LocalUser } from "../auth/credentials.ts";
import { getLocalUser } from "../auth/sessions.ts";
export { rejectCrossOrigin } from "./origin.ts";

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

export async function readJson<T>(request: Request): Promise<T | null> {
  return request.json().catch(() => null) as Promise<T | null>;
}
