import { assertStorageReady } from "@/server/config";
import { APPLICATION_VERSION } from "@/lib/version";
import {
  currentSchemaVersion,
  expectedSchemaVersion as getExpectedSchemaVersion,
  getDatabase,
} from "@/db/sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    assertStorageReady();
    const database = getDatabase();
    database.prepare("SELECT 1").get();
    const schemaVersion = currentSchemaVersion(database);
    const expectedSchemaVersion = getExpectedSchemaVersion();
    const ready = schemaVersion === expectedSchemaVersion;
    return Response.json(
      {
        status: ready ? "ready" : "degraded",
        version: APPLICATION_VERSION,
      },
      {
        status: ready ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
