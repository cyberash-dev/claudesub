import { spawn } from "node:child_process";
import type { RenameCredentialStore } from "../../ports/outbound/RenameCredentialStore.js";

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

export class ChildProcessRenameCredentialStore implements RenameCredentialStore {
  constructor(private readonly account: string) {}

  async read(service: string): Promise<string> {
    const res = await runSecurity(["find-generic-password", "-s", service, "-a", this.account, "-w"]);
    if (res.code === 44) {
      throw new Error(`Keychain entry "${service}" not found.`);
    }
    if (res.code !== 0) {
      throw new Error(`security find-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
    return res.stdout.replace(/\n$/, "");
  }

  async write(service: string, blob: string): Promise<void> {
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

  async delete(service: string): Promise<void> {
    const res = await runSecurity(["delete-generic-password", "-s", service, "-a", this.account]);
    if (res.code === 44 || res.code === 0) return;
    throw new Error(`security delete-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
}
