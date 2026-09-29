import {
  currentV6SchemaVersion,
  expectedV6SchemaVersion,
  getV6Database,
} from "@/db/v6-sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const database = getV6Database();
    database.prepare("SELECT 1").get();
    const schemaVersion = currentV6SchemaVersion(database);
    const expectedSchemaVersion = expectedV6SchemaVersion();
    const ready = schemaVersion === expectedSchemaVersion;
    return Response.json(
      {
        status: ready ? "ready" : "degraded",
        database: "sqlite",
        schemaVersion,
        expectedSchemaVersion,
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

