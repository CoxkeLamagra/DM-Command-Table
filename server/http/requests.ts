import type { LocalUser } from "../auth/credentials.ts";
import { getLocalUser } from "../auth/sessions.ts";
import { jsonError } from "./responses.ts";
export { rejectCrossOrigin } from "./origin.ts";

export async function authorizeRequest(options: { admin?: boolean } = {}) {
  const user = await getLocalUser();
  if (!user) {
    return {
      response: jsonError("Sign in required.", 401),
    } as const;
  }
  if (options.admin && !user.isAdmin) {
    return {
      response: jsonError("Administrator access required.", 403),
    } as const;
  }
  return { user } as { user: LocalUser };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  return request.json().catch(() => null) as Promise<T | null>;
}
