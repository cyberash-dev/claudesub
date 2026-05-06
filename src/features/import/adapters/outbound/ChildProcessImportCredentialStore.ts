import { spawn } from "node:child_process";
import type { ImportCredentialStore } from "../../ports/outbound/ImportCredentialStore.js";

interface SecurityResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runSecurity(args: string[]): Promise<SecurityResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/security", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export class ChildProcessImportCredentialStore implements ImportCredentialStore {
  constructor(private readonly account: string) {}

  async writeProfile(service: string, blob: string): Promise<void> {
    const res = await runSecurity([
      "add-generic-password", "-U",
      "-s", service,
      "-a", this.account,
      "-w", blob,
      "-l", `Claude Code subscription profile (${service})`,
    ]);
    if (res.code !== 0) {
      throw new Error(`security add-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
  }
}
