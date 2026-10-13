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
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => process.exit(code ?? 1));
