import { PublicApiError } from "./errors.ts";
let active = 0;
export function isPackageWork(pathname: string): boolean {
  return (
    pathname === "/api/campaigns/import" ||
    /^\/api\/campaigns\/[^/]+\/package$/.test(pathname)
  );
}
// Bound expensive image-package work before reading request bodies; reject rather than queue.
export async function withPackageWork<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (active >= 2)
    throw new PublicApiError(
      "Campaign package processing is busy. Please try again shortly.",
      503,
    );
  active++;
  try {
    return await operation();
  } finally {
    active--;
  }
}
