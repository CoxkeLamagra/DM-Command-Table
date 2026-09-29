import { ZodError } from "zod";
import { AuthorizationError } from "./access.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";

export type V6ApiContext = {
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
  if (error instanceof ZodError)
    return apiJson(
      { error: "The request is invalid.", issues: error.issues },
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
    return apiJson(
      { error: error.message, code: "not_found" },
      404,
    );
  if (error instanceof AuthorizationError)
    return apiJson(
      { error: error.message, code: "forbidden" },
      403,
    );
  if (error instanceof SyntaxError)
    return apiJson({ error: "The request body is not valid JSON." }, 400);
  if (error instanceof Error)
    return apiJson({ error: error.message }, 400);
  return apiJson({ error: "The request could not be completed." }, 500);
}

export async function jsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    throw new Error("Content-Type must be application/json.");
  return request.json();
}

