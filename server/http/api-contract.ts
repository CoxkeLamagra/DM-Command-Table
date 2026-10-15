/** Supported catch-all API shapes. Reject aliases before dispatch can fall back. */
export function acceptsApiRoute(segments: string[], method: string): boolean {
  const [root, id, resource, record, child, childId] = segments;
  const size = segments.length;
  if (root === "templates")
    return (
      (size === 1 && ["GET", "POST"].includes(method)) ||
      (size === 2 && method === "DELETE")
    );
  if (root !== "campaigns") return false;
  if (size === 1) return ["GET", "POST"].includes(method);
  if (id === "import") return size === 2 && method === "POST";
  if (size === 2) return ["GET", "PATCH", "DELETE"].includes(method);
  if (["export", "package", "search"].includes(resource))
    return size === 3 && method === "GET";
  if (resource === "copy") return size === 3 && method === "POST";
  if (resource === "members")
    return (
      (size === 3 && ["GET", "POST"].includes(method)) ||
      (size === 4 &&
        (record === "transfer" ? method === "POST" : method === "DELETE"))
    );
  if (resource === "combat")
    return (
      (size === 3 && ["GET", "PUT"].includes(method)) ||
      (size === 4 &&
        ["command", "undo", "load-prepared"].includes(record) &&
        method === "POST")
    );
  if (!["players", "monsters", "sessions", "story"].includes(resource))
    return false;
  if (size === 3) return ["GET", "POST"].includes(method);
  if (size === 4)
    return record === "bulk-delete" &&
      ["players", "monsters"].includes(resource)
      ? method === "POST"
      : ["PATCH", "DELETE"].includes(method);
  if (resource !== "sessions") return false;
  if (size === 5 && child === "save") return method === "POST";
  if (child !== "encounters") return false;
  if (size === 5) return ["GET", "POST"].includes(method);
  return (
    size === 6 &&
    (childId === "reorder"
      ? method === "POST"
      : ["PATCH", "DELETE"].includes(method))
  );
}
