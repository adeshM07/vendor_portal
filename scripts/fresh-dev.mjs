import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const lockPath = join(".next", "dev", "lock");

function stopStaleDevServer() {
  if (!existsSync(lockPath)) return;

  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const pid = lock?.pid;
    if (!pid) return;

    console.log(
      `Stopping stale Next.js dev server (PID ${pid}, port ${lock.port ?? "unknown"})...`
    );

    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    // Process may already be gone.
  }
}

function cleanNextCache() {
  if (!existsSync(".next")) return;
  console.log("Removing .next cache...");
  rmSync(".next", { recursive: true, force: true });
}

stopStaleDevServer();
cleanNextCache();

console.log("Starting Next.js dev server on http://localhost:3000 ...");

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
