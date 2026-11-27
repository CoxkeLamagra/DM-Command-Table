import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../../db/sqlite.ts";
import type { User } from "../../domain/types.ts";
import { getUser } from "../identity/auth.ts";
import { apiError, apiJson } from "./http.ts";
import { rejectCrossOrigin } from "./origin.ts";
import { rateLimited, type RateLimitName } from "./request-security.ts";

export type AuthenticatedRequest = {
  request: Request;
  database: DatabaseSync;
  user: User;
};

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Shared front door for authenticated API route files: rejects cross-site
 * mutations, resolves the signed-in account (401, or 403 for `admin` routes),
 * charges an optional rate-limit budget and maps thrown errors to the JSON
 * error shape. Extra Next.js arguments (route params) pass through.
 */
export function withApiUser<Args extends unknown[]>(
  handler: (
    input: AuthenticatedRequest,
    ...args: Args
  ) => Promise<Response> | Response,
  options: { admin?: boolean; rateLimit?: RateLimitName } = {},
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    if (!READ_METHODS.has(request.method.toUpperCase())) {
      const originError = rejectCrossOrigin(request);
      if (originError) return originError;
    }
    try {
      const database = getDatabase();
      const user = await getUser(database);
      if (options.admin && !user?.isAdmin)
        return apiJson({ error: "Administrator access required." }, 403);
      if (!user) return apiJson({ error: "Authentication required." }, 401);
      if (options.rateLimit) {
        const limited = rateLimited(
          database,
          request,
          options.rateLimit,
          user.userId,
        );
        if (limited) return limited;
      }
      return await handler({ request, database, user }, ...args);
    } catch (error) {
      return apiError(error);
    }
  };
}
