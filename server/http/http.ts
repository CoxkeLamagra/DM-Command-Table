import { readRequestBody as boundedRequestBytes } from "./body-reader.ts";
import { allocationByteLimit } from "../security/allocation-budget.ts";
import { assertJsonStructure, assertJsonTextStructure } from "./validation.ts";
import { CombatCapacityError } from "../../domain/combat.ts";
import { JSON_BODY_LIMIT } from "../../domain/limits.ts";
import { ZodError } from "zod";
import { AuthorizationError } from "../campaigns/access.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";
import { PublicApiError, RequestTooLargeError } from "./errors.ts";

export type ApiContext = {
  userId: string;
  isAdmin: boolean;
};

export function apiJson(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
      vary: "Cookie",
    },
  });
}

export function apiError(error: unknown): Response {
  if (error instanceof Error && "errcode" in error && error.errcode === 13)
    return apiJson(
      {
        error:
          "Database storage limit reached. Remove unused data or contact the host administrator.",
      },
      413,
    );
  if (error instanceof CombatCapacityError)
    return apiJson({ error: error.message }, 400);
  if (error instanceof RequestTooLargeError)
    return apiJson({ error: error.message }, 413);
  if (error instanceof ZodError)
    return apiJson(
      {
        error: "The request is invalid.",
        issues: error.issues.slice(0, 8).map((issue) => ({
          code: issue.code,
          message: issue.message.slice(0, 200),
          path: issue.path
            .slice(0, 16)
            .map((part) =>
              typeof part === "string" ? part.slice(0, 80) : part,
            ),
        })),
      },
      400,
    );
  if (error instanceof RevisionConflictError)
    return apiJson(
      {
        error: error.message,
        code: "revision_conflict",
        resourceType: error.resourceType,
        resourceId: error.resourceId,
        expectedRevision: error.expectedRevision,
        actualRevision: error.actualRevision,
      },
      409,
    );
  if (error instanceof ResourceNotFoundError)
    return apiJson({ error: error.message, code: "not_found" }, 404);
  if (error instanceof AuthorizationError)
    return apiJson({ error: error.message, code: "forbidden" }, 403);
  if (error instanceof SyntaxError)
    return apiJson({ error: "The request body is not valid JSON." }, 400);
  if (error instanceof PublicApiError)
    return apiJson({ error: error.message }, error.status);
  if (error instanceof Error) {
    console.error("Unexpected API error", error);
    return apiJson({ error: "The request could not be completed." }, 500);
  }
  return apiJson({ error: "The request could not be completed." }, 500);
}

export async function jsonBody(
  request: Request,
  maximumBytes = JSON_BODY_LIMIT,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    throw new PublicApiError("Content-Type must be application/json.", 415);
  const bytes = await boundedRequestBytes(
    request,
    allocationByteLimit(maximumBytes),
  );
  const text = new TextDecoder().decode(bytes);
  assertJsonTextStructure(text);
  const value: unknown = JSON.parse(text);
  assertJsonStructure(value);
  return value;
}

export { readRequestBody as boundedRequestBytes } from "./body-reader.ts";
