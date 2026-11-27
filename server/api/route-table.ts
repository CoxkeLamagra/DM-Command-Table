import type { DatabaseSync } from "node:sqlite";
import type { ApiContext } from "../http/http.ts";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Campaign permission checked before a handler runs. `user` needs only an
 * authenticated account; the others need that role on `:campaignId`.
 * Repositories repeat their own checks as a second line of defence.
 */
export type RouteAccess = "user" | "read" | "edit" | "owner";

export type RouteInput = {
  request: Request;
  database: DatabaseSync;
  context: ApiContext;
  url: URL;
  /** Decoded path parameters named in the route pattern. */
  params: Record<string, string>;
  /** Validated `:campaignId`, or an empty string on account-level routes. */
  campaignId: string;
};

export type RouteHandler = (input: RouteInput) => Promise<Response> | Response;

export type RouteDefinition = {
  method: ApiMethod;
  /** Path below `/api/`, with `:name` for parameters, e.g. `campaigns/:campaignId/players/:id`. */
  path: string;
  access: RouteAccess;
  handler: RouteHandler;
};

export type RouteMatch = {
  route: RouteDefinition;
  params: Record<string, string>;
};

export function route(
  method: ApiMethod,
  path: string,
  access: RouteAccess,
  handler: RouteHandler,
): RouteDefinition {
  return { method, path, access, handler };
}

const isParam = (part: string) => part.startsWith(":");
const prefixKey = (parts: string[]) =>
  parts.map((part) => (isParam(part) ? "*" : part)).join("/");

/**
 * The single list of supported API shapes. A request matches only a route with
 * the same method and segment count. A parameter never matches a word that is a
 * literal segment of another route at the same position (for example
 * `players/bulk-delete` or `encounters/reorder`), so an unsupported method on a
 * literal path is a 404 instead of falling back to the parameter route.
 */
export function createRouteTable(definitions: RouteDefinition[]) {
  const compiled = definitions.map((definition) => ({
    definition,
    parts: definition.path.split("/"),
  }));
  const reserved = new Map<string, Set<string>>();
  const seen = new Set<string>();
  for (const { definition, parts } of compiled) {
    const signature = `${definition.method} ${prefixKey(parts)}`;
    if (seen.has(signature))
      throw new Error(
        `Duplicate API route: ${definition.method} ${definition.path}`,
      );
    seen.add(signature);
    parts.forEach((part, index) => {
      if (isParam(part)) return;
      const key = prefixKey(parts.slice(0, index));
      if (!reserved.has(key)) reserved.set(key, new Set());
      reserved.get(key)!.add(part);
    });
  }

  function match(segments: string[], method: string): RouteMatch | null {
    for (const { definition, parts } of compiled) {
      if (definition.method !== method || parts.length !== segments.length)
        continue;
      const params: Record<string, string> = {};
      const matches = parts.every((part, index) => {
        const value = segments[index];
        if (!isParam(part)) return part === value;
        if (reserved.get(prefixKey(parts.slice(0, index)))?.has(value))
          return false;
        params[part.slice(1)] = value;
        return true;
      });
      if (matches) return { route: definition, params };
    }
    return null;
  }

  return { routes: definitions, match };
}
