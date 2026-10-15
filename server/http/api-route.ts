import { PublicApiError } from "./errors.ts";

export function parseApiRoute(pathname: string) {
  let segments: string[];
  try {
    segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    throw new PublicApiError("Invalid API path.", 400);
  }
  if (
    segments.shift() !== "api" ||
    segments.some((segment) => /[%\\/\u0000-\u0020\u007f]/.test(segment))
  )
    throw new PublicApiError("Invalid API path.", 400);
  const isImport = segments[0] === "campaigns" && segments[1] === "import";
  const isPackage = segments[0] === "campaigns" && segments[2] === "package";
  if (
    (isImport && segments.length !== 2) ||
    (isPackage && segments.length !== 3)
  )
    throw new PublicApiError("Invalid API path.", 400);
  return { segments, isImport, isPackageWork: isImport || isPackage };
}
export type ApiRoute = ReturnType<typeof parseApiRoute>;
