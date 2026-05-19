#!/usr/bin/env node

import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
  const current = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (current === ".githooks") {
    console.log("Git hooks activos en .githooks");
    process.exit(0);
  }
} catch {
  // No hooksPath configured yet, or this is not a git checkout.
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  console.log("Git hooks activos en .githooks");
} catch (err) {
  if (process.env.CI) process.exit(0);
  console.warn(`No se pudieron activar los hooks de Git: ${err?.message ?? err}`);
}
