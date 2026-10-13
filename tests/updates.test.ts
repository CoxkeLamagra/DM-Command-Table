import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createUpdateBroker } from "../deploy/debian-13/update-broker.mjs";
import { createConnection } from "node:net";

test("broker rejects command/target injection, coalesces starts and persists bounded progress", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-updates-"));
  const socketPath = path.join(directory, "control.sock");
  const statePath = path.join(directory, "latest.json");
  let launches = 0;
  const broker = createUpdateBroker({
    socketPath,
    statePath,
    launch: () => {
      launches++;
      return spawn(
        process.execPath,
        [
          "-e",
          'process.stdout.write("@@STEP verify\\n"); setTimeout(() => { process.stdout.write("x".repeat(70000)+"\\n@@STEP health\\n"); setTimeout(()=>process.exit(0), 100); }, 100);',
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    },
  });
  try {
    assert.throws(() =>
      broker.handle({ action: "start", actor: "admin", target: "; rm" }),
    );
    assert.throws(() => broker.handle({ action: "exec", command: "id" }));
    assert.equal(launches, 0);
    const first = broker.handle({
      action: "start",
      actor: "admin",
    });
    const second = broker.handle({
      action: "start",
      actor: "other-admin",
    });
    assert.equal(first.job?.id, second.job?.id);
    assert.equal(launches, 1);
    let result = second;
    for (let i = 0; i < 100 && result.job?.status === "running"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      result = broker.handle({ action: "status" });
    }
    assert.equal(result.job?.status, "succeeded");
    assert.equal(result.job?.exitCode, 0);
    assert.ok(result.job!.log.length <= 65536);
    assert.deepEqual(result.job?.steps, [
      { id: "verify", status: "succeeded" },
      { id: "health", status: "succeeded" },
    ]);
    assert.equal(
      JSON.parse(readFileSync(statePath, "utf8")).status,
      "succeeded",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("broker records failure and detects interrupted jobs after its own restart", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-updates-"));
  const socketPath = path.join(directory, "control.sock"),
    statePath = path.join(directory, "latest.json");
  writeFileSync(
    statePath,
    JSON.stringify({ status: "running", log: "existing output", steps: [] }),
  );
  const broker = createUpdateBroker({
    socketPath,
    statePath,
    launch: () =>
      spawn(
        process.execPath,
        ["-e", 'process.stdout.write("@@STEP verify\\n"); process.exit(1)'],
        { stdio: ["ignore", "pipe", "pipe"] },
      ),
  });
  try {
    assert.equal(
      broker.handle({ action: "status" }).job?.status,
      "interrupted",
    );
    broker.handle({ action: "start", actor: "admin" });
    let result = broker.handle({ action: "status" });
    for (let i = 0; i < 100 && result.job?.status === "running"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      result = broker.handle({ action: "status" });
    }
    assert.equal(result.job?.status, "failed");
    assert.deepEqual(result.job?.steps, [{ id: "verify", status: "failed" }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("broker socket serves bounded local requests", async (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-updates-socket-"));
  const socketPath = path.join(directory, "control.sock");
  const broker = createUpdateBroker({
    socketPath,
    statePath: path.join(directory, "latest.json"),
  });
  try {
    try {
      await broker.listen();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") {
        context.skip(
          "Workspace prohibits Unix socket listeners; core broker tests still run.",
        );
        return;
      }
      throw error;
    }
    const response = await new Promise<string>((resolve, reject) => {
      const socket = createConnection(socketPath);
      let data = "";
      socket.on("error", reject);
      socket.on("connect", () => socket.write('{"action":"status"}\n'));
      socket.on("data", (chunk) => {
        data += chunk;
      });
      socket.on("end", () => resolve(data));
    });
    assert.deepEqual(JSON.parse(response), {
      available: true,
      target: "latest",
      job: null,
    });
  } finally {
    if (broker.server.listening)
      await new Promise<void>((resolve) =>
        broker.server.close(() => resolve()),
      );
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a recovered deployment remains failed while rollback is marked completed", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-update-recovery-"));
  const broker = createUpdateBroker({
    socketPath: path.join(directory, "control.sock"),
    statePath: path.join(directory, "latest.json"),
    launch: () =>
      spawn(
        process.execPath,
        [
          "-e",
          'process.stdout.write("@@STEP health\\n@@STEP rollback\\n@@DONE rollback\\n"); process.exit(1)',
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      ),
  });
  try {
    let result = broker.handle({ action: "start", actor: "admin" });
    for (let i = 0; i < 100 && result.job?.status === "running"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      result = broker.handle({ action: "status" });
    }
    assert.equal(result.job?.status, "failed");
    assert.deepEqual(result.job?.steps, [
      { id: "health", status: "failed" },
      { id: "rollback", status: "succeeded" },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("broker validates root-configured targets and records launch errors", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "dmct-update-launch-"));
  const options = {
    socketPath: path.join(directory, "control.sock"),
    statePath: path.join(directory, "latest.json"),
    launch: () => {
      throw new Error("launch failed");
    },
  };
  try {
    assert.throws(() => createUpdateBroker({ ...options, target: "--help" }));
    const broker = createUpdateBroker(options);
    const result = broker.handle({ action: "start", actor: "admin" });
    assert.equal(result.job?.status, "failed");
    assert.equal(result.job?.exitCode, -1);
    assert.match(result.job!.log, /Could not launch/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
