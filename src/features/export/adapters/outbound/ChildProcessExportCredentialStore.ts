import { spawn } from "node:child_process";
import type { ExportCredentialStore } from "../../ports/outbound/ExportCredentialStore.js";

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

export class ChildProcessExportCredentialStore implements ExportCredentialStore {
  constructor(private readonly account: string) {}

  async readProfile(service: string): Promise<string> {
    const res = await runSecurity(["find-generic-password", "-s", service, "-a", this.account, "-w"]);
    if (res.code === 44) {
      throw new Error(`Profile keychain entry "${service}" not found.`);
    }
    if (res.code !== 0) {
      throw new Error(`security find-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
    return res.stdout.replace(/\n$/, "");
  }
}
