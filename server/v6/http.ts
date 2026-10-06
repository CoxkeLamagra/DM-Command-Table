import { ZodError } from "zod";
import { AuthorizationError } from "./access.ts";
import { ResourceNotFoundError, RevisionConflictError } from "./conflicts.ts";
import { PublicApiError, RequestTooLargeError } from "./errors.ts";

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
  if (error instanceof RequestTooLargeError)
    return apiJson({ error: error.message }, 413);
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
  maximumBytes = 4 * 1024 * 1024,
): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    throw new PublicApiError("Content-Type must be application/json.", 415);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes)
    throw new RequestTooLargeError();
  if (!request.body) throw new SyntaxError("The request body is empty.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
