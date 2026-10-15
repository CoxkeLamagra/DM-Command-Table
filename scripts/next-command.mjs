import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const command = process.argv[2];
if (!["dev", "build"].includes(command)) throw new Error("Use dev or build.");
const child = spawn(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve("next/dist/bin/next")),
    command,
    ...process.argv.slice(3),
  ],
  {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      ...(command === "build"
        ? {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=1536`,
          }
        : {}),
    },
  },
);
const kill = (signal) => {
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
};
const deadline =
  command === "build"
    ? setTimeout(
        () => {
          console.error("Build exceeded its 20-minute deadline.");
          kill("SIGKILL");
        },
        20 * 60 * 1000,
      )
    : null;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => kill(signal));
child.on("error", (error) => {
  if (deadline) clearTimeout(deadline);
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (deadline) clearTimeout(deadline);
  process.exit(code ?? 1);
});
