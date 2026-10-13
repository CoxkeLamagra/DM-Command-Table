import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export async function checkInstallation(
  version,
  {
    direct = "http://127.0.0.1:3000",
    proxy = "http://127.0.0.1",
    socketPath = "/run/dm-command-table-updater/control.sock",
    attempts = 30,
    retryDelay = 1000,
  } = {},
) {
  if (!/^11\.\d+\.\d+$/.test(version))
    throw new Error("Expected a stable v11 version.");
  let failure;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      for (const origin of [direct, proxy]) {
        const response = await fetch(`${origin}/api/health`, {
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("Application health request failed.");
        const health = await response.json();
        if (health.status !== "ready" || health.version !== version)
          throw new Error("Application is not ready at the expected version.");
      }
      const unauthorized = await fetch(`${proxy}/api/campaigns`, {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      if (unauthorized.status !== 401)
        throw new Error("Unauthenticated campaign access must return 401.");
      await new Promise((resolve, reject) => {
        const socket = net.createConnection(socketPath);
        let data = "";
        const fail = (error) => {
          socket.destroy();
          reject(error);
        };
        socket.setTimeout(5000, () =>
          fail(new Error("Updater socket timed out.")),
        );
        socket.on("error", fail);
        socket.on("connect", () => socket.write('{"action":"status"}\n'));
        socket.on("data", (chunk) => {
          data += chunk.toString("utf8");
          if (data.length > 128 * 1024)
            fail(new Error("Updater response is too large."));
        });
        socket.on("end", () => {
          try {
            const status = JSON.parse(data);
            if (status.available !== true || status.target !== "latest")
              throw new Error(
                "Automatic updater is unavailable or not configured for latest stable releases.",
              );
            resolve();
          } catch (error) {
            fail(error);
          }
        });
      });
      return;
    } catch (error) {
      failure = error;
      if (attempt + 1 < attempts) await delay(retryDelay);
    }
  }
  throw failure ?? new Error("Installation readiness check failed.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await checkInstallation(process.argv[2]);
  console.log(
    "Application, reverse proxy, authentication boundary and automatic updater are ready.",
  );
}
