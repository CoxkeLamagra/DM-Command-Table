import net from "node:net";
import { spawn } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { pathToFileURL } from "node:url";

// Separate root-owned service. The socket grants only status and a fixed update
// action; client data never supplies an executable, argument or environment.
/** @param {{ socketPath: string, statePath: string, target?: string, launch?: () => import("node:child_process").ChildProcessByStdio<null, import("node:stream").Readable, import("node:stream").Readable> }} options */
export function createUpdateBroker({
  socketPath,
  statePath,
  target = "origin/main",
  launch = () =>
    spawn("/usr/local/sbin/update-dm-command-table", [target], {
      cwd: "/",
      env: {
        PATH: "/usr/sbin:/usr/bin:/sbin:/bin",
        HOME: "/root",
        LANG: "C.UTF-8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }),
}) {
  if (!/^(origin\/main|v\d+\.\d+\.\d+|[a-f0-9]{40})$/.test(target))
    throw new Error(
      "Configure origin/main, a release tag or a full commit SHA.",
    );
  let job = null;
  try {
    job = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    /* First run. */
  }
  const persist = () => {
    writeFileSync(statePath + ".next", JSON.stringify(job), { mode: 0o600 });
    renameSync(statePath + ".next", statePath);
  };
  if (job?.status === "running") {
    job.status = "interrupted";
    job.finishedAt = Date.now();
    for (const step of job.steps ?? [])
      if (step.status === "running") step.status = "failed";
    job.log +=
      "\nUpdate service restarted; inspect the service and current release before retrying.\n";
    persist();
  }
  function append(data) {
    const output = Buffer.from(
      job.log + data.toString("utf8").replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ""),
    );
    let offset = Math.max(0, output.length - 65536);
    while ((output[offset] & 0xc0) === 0x80) offset++;
    job.log = output.subarray(offset).toString("utf8");
    persist();
  }
  function start(actor) {
    if (job?.status === "running") return;
    job = {
      id: crypto.randomUUID(),
      status: "running",
      target,
      actor,
      startedAt: Date.now(),
      finishedAt: null,
      exitCode: null,
      log: "",
      steps: [],
    };
    persist();
    let child;
    const finish = (code) => {
      if (job.status !== "running") return;
      job.status = code === 0 ? "succeeded" : "failed";
      job.exitCode = code;
      job.finishedAt = Date.now();
      for (const step of job.steps)
        if (step.status === "running")
          step.status = code === 0 ? "succeeded" : "failed";
      persist();
    };
    try {
      child = launch();
      let pending = "";
      child.stdout.on("data", (data) => {
        pending = pending + data.toString("utf8");
        const lines = pending.split("\n");
        pending = lines.pop().slice(-1024);
        for (const line of lines) {
          if (line === "@@DONE rollback") {
            const step = job.steps.find((step) => step.id === "rollback");
            if (step) step.status = "succeeded";
            continue;
          }
          const match = line.match(
            /^@@STEP (prerequisites|fetch|install|build|test|package|backup|switch|health|cleanup|rollback)$/,
          );
          if (!match) continue;
          for (const step of job.steps)
            if (step.status === "running")
              step.status = match[1] === "rollback" ? "failed" : "succeeded";
          if (!job.steps.some((step) => step.id === match[1]))
            job.steps.push({ id: match[1], status: "running" });
        }
        append(data);
      });
      child.stderr.on("data", append);
      child.on("error", () => {
        append("Could not launch the installed updater.\n");
        finish(-1);
      });
      child.on("close", (code) => finish(code ?? -1));
    } catch {
      append("Could not launch the installed updater.\n");
      finish(-1);
    }
  }
  function handle(request) {
    const keys = Object.keys(request).sort().join(",");
    if (
      request.action === "start" &&
      keys === "action,actor" &&
      typeof request.actor === "string" &&
      /^[a-zA-Z0-9-]{1,64}$/.test(request.actor)
    )
      start(request.actor);
    else if (!(request.action === "status" && keys === "action"))
      throw new Error("Invalid request");
    return structuredClone({ available: true, target, job });
  }
  let connections = 0;
  const server = net.createServer((socket) => {
    if (++connections > 16) {
      socket.destroy();
      connections--;
      return;
    }
    socket.on("close", () => connections--);
    socket.on("error", () => {});
    socket.setTimeout(5000, () => socket.destroy());
    let bytes = 0,
      input = "",
      handled = false;
    socket.on("data", (chunk) => {
      if (handled) return;
      bytes += chunk.length;
      if (bytes > 1024) {
        socket.destroy();
        return;
      }
      input += chunk.toString("utf8");
      if (!input.includes("\n")) return;
      handled = true;
      try {
        const request = JSON.parse(input.slice(0, input.indexOf("\n")));
        socket.end(JSON.stringify(handle(request)) + "\n");
      } catch {
        socket.end(JSON.stringify({ error: "Invalid update request." }) + "\n");
      }
    });
  });
  return {
    handle,
    server,
    listen: () =>
      new Promise((resolve, reject) => {
        // systemd owns the containing directory; only root can replace this socket.
        try {
          unlinkSync(socketPath);
        } catch (error) {
          if (error.code !== "ENOENT") return reject(error);
        }
        server.once("error", reject);
        server.listen(socketPath, () => {
          chmodSync(socketPath, 0o660);
          resolve();
        });
      }),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.getuid?.() !== 0)
    throw new Error("Update broker must run as root.");
  const broker = createUpdateBroker({
    socketPath: "/run/dm-command-table-updater/control.sock",
    statePath: "/var/lib/dm-command-table-updater/latest.json",
    target: process.env.DM_COMMAND_TABLE_UPDATE_TARGET || "origin/main",
  });
  await broker.listen();
}
