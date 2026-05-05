import { spawn } from "node:child_process";
import type { RmCredentialStore } from "../../ports/outbound/RmCredentialStore.js";

interface SecurityResult {
  code: number;
  stderr: string;
}

function runSecurity(args: string[]): Promise<SecurityResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/security", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

export class ChildProcessRmCredentialStore implements RmCredentialStore {
  constructor(private readonly account: string) {}

  async deleteProfile(service: string): Promise<boolean> {
    const res = await runSecurity(["delete-generic-password", "-s", service, "-a", this.account]);
    if (res.code === 44) return false;
    if (res.code !== 0) {
      throw new Error(`security delete-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
    return true;
  }
}
