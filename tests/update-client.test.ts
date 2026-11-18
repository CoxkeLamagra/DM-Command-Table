import assert from "node:assert/strict";
import test from "node:test";
import { createServer, createConnection, type Socket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { requestUpdateService } from "../server/administration/update-client.ts";

async function service(accept: (socket: Socket, request: Buffer) => void) {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-client-"));
  const socketPath = path.join(directory, "control.sock");
  const connections = new Set<Socket>();
  const server = createServer((socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
    socket.on("error", () => undefined);
    socket.setNoDelay(true);
    socket.once("data", (request: Buffer) => accept(socket, request));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  return {
    request: (timeoutMs = 1000) =>
      requestUpdateService(
        createConnection(socketPath),
        "status",
        undefined,
        timeoutMs,
      ),
    close: async () => {
      for (const socket of connections) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("updater client preserves Unicode split between packets and sends the fixed request", async () => {
  const expected = {
    available: true,
    target: "latest",
    job: { log: "Café 🎲 — prêt" },
  };
  const fixture = await service((socket, request) => {
    assert.deepEqual(JSON.parse(request.toString("utf8")), {
      action: "status",
    });
    const bytes = Buffer.from(JSON.stringify(expected) + "\n");
    const cut = bytes.indexOf(Buffer.from("🎲")) + 1;
    socket.write(bytes.subarray(0, cut));
    void delay(20).then(() => socket.end(bytes.subarray(cut)));
  });
  try {
    assert.deepEqual(await fixture.request(), expected);
  } finally {
    await fixture.close();
  }
});

test(
  "updater client has a total deadline even while bytes keep arriving",
  { timeout: 3000 },
  async () => {
    const fixture = await service((socket) => {
      const timer = setInterval(() => socket.write(" "), 10);
      socket.once("close", () => clearInterval(timer));
    });
    try {
      await assert.rejects(fixture.request(100), /did not respond/);
    } finally {
      await fixture.close();
    }
  },
);

test("updater client rejects oversized, malformed and incomplete responses", async () => {
  for (const response of [
    "x".repeat(512 * 1024 + 1),
    "not JSON\n",
    '{"available":false}\n',
    '{"available":true',
  ]) {
    const fixture = await service((socket) => socket.end(response));
    try {
      await assert.rejects(
        fixture.request(),
        /Invalid update service response|closed the connection/,
      );
    } finally {
      await fixture.close();
    }
  }
});

test("missing updater service remains unavailable for status and an error for start", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-client-missing-"));
  try {
    const filename = path.join(directory, "absent.sock");
    assert.deepEqual(
      await requestUpdateService(createConnection(filename), "status"),
      { available: false, job: null },
    );
    await assert.rejects(
      requestUpdateService(
        createConnection(filename),
        "start",
        "administrator",
      ),
      /unavailable/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
