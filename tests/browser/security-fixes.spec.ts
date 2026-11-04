import { test, expect } from "@playwright/test";

test("HTTPS edge sessions are Secure and CSP covers prefetch HTML while HTTP LAN login works", async ({
  playwright,
  request,
}) => {
  const prefetchHeaders: Record<string, string>[] = [
    { purpose: "prefetch" },
    { "next-router-prefetch": "1" },
  ];
  for (const headers of prefetchHeaders) {
    const response = await request.get("/", { headers });
    expect(response.headers()["content-security-policy"]).toContain(
      "script-src 'self' 'nonce-",
    );
  }
  const edge = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  try {
    const response = await edge.post("/api/auth", {
      headers: { origin: "https://127.0.0.1:3100" },
      data: {
        action: "login",
        username: "browser-offline",
        password: "browser-test-pass",
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).toMatch(/; Secure(?:;|$)/i);
    expect(response.headers()["set-cookie"]).toMatch(/; HttpOnly(?:;|$)/i);
  } finally {
    await edge.dispose();
  }
  const lan = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  try {
    const response = await lan.post("/api/auth", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: {
        action: "login",
        username: "browser-offline",
        password: "browser-test-pass",
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["set-cookie"]).not.toMatch(/; Secure(?:;|$)/i);
    expect((await lan.get("/api/campaigns")).status()).toBe(200);
  } finally {
    await lan.dispose();
  }
});

test("encoded and canonical imports consume the same strict rate bucket before body processing", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  try {
    expect(
      (
        await api.post("/api/auth", {
          data: {
            action: "login",
            username: "browser-security",
            password: "browser-test-pass",
          },
        })
      ).status(),
    ).toBe(200);
    const paths = [
      "/api/campaigns/import",
      "/api/%63ampaigns/%69mport",
      "/api/campaigns/im%70ort",
    ];
    for (let i = 0; i < 10; i++)
      expect(
        (await api.post(paths[i % paths.length], { data: {} })).status(),
      ).toBe(400);
    expect((await api.post(paths[1], { data: {} })).status()).toBe(429);
    expect((await api.post(paths[0], { data: {} })).status()).toBe(429);
  } finally {
    await api.dispose();
  }
});

test("real incomplete HTTP bodies have bounded admission, release on disconnect and expire", async ({
  request,
}) => {
  const { request: nodeRequest } = await import("node:http");
  const held: ReturnType<typeof nodeRequest>[] = [];
  const begin = () => {
    let response!: Promise<number>;
    const connected = new Promise<void>((resolve, reject) => {
      response = new Promise<number>((done, fail) => {
        const incoming = nodeRequest(
          "http://127.0.0.1:3100/api/auth",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": "1024",
            },
          },
          (result) => {
            result.resume();
            done(result.statusCode ?? 0);
          },
        );
        held.push(incoming);
        incoming.on("error", (error) => {
          reject(error);
          fail(error);
        });
        incoming.on("socket", (socket) => socket.once("connect", resolve));
        incoming.flushHeaders();
      });
      // Disconnects below intentionally reject this response promise.
      void response.catch(() => undefined);
    });
    return { connected, response: () => response };
  };
  const logout = () =>
    request.post("/api/auth", { data: { action: "logout" } });
  try {
    const first = begin(),
      second = begin();
    await Promise.all([first.connected, second.connected]);
    await expect.poll(async () => (await logout()).status()).toBe(503);
    expect((await request.get("/api/health")).status()).toBe(200);
    for (const connection of held) connection.destroy();
    await expect.poll(async () => (await logout()).status()).toBe(200);
    const started = Date.now(),
      stalled = begin();
    await stalled.connected;
    expect(await stalled.response()).toBe(408);
    expect(Date.now() - started).toBeGreaterThan(25_000);
    expect(Date.now() - started).toBeLessThan(38_000);
    expect((await logout()).status()).toBe(200);
    expect((await request.get("/api/health")).status()).toBe(200);
  } finally {
    for (const connection of held) connection.destroy();
  }
});
