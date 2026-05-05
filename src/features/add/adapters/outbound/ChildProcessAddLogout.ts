import { spawn } from "node:child_process";
import type { AddLogout } from "../../ports/outbound/AddLogout.js";

export class ChildProcessAddLogout implements AddLogout {
  run(): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn("claude", ["auth", "logout"], { stdio: "inherit" });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? -1));
    });
  }
}
