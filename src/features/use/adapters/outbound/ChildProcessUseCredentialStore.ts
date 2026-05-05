import { spawn } from "node:child_process";
import type { UseCredentialStore } from "../../ports/outbound/UseCredentialStore.js";

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

export class ChildProcessUseCredentialStore implements UseCredentialStore {
  constructor(
    private readonly account: string,
    private readonly liveService: string,
  ) {}

  async readLive(): Promise<string> {
    return this.read(this.liveService);
  }

  async writeLive(blob: string): Promise<void> {
    return this.write(this.liveService, blob, "Claude Code-credentials");
  }

  async readProfile(service: string): Promise<string> {
    return this.read(service);
  }

  async writeProfile(service: string, blob: string): Promise<void> {
    return this.write(service, blob, `Claude Code subscription profile (${service})`);
  }

  private async read(service: string): Promise<string> {
    const res = await runSecurity(["find-generic-password", "-s", service, "-a", this.account, "-w"]);
    if (res.code === 44) {
      throw new Error(`Keychain entry "${service}" not found.`);
    }
    if (res.code !== 0) {
      throw new Error(`security find-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
    return res.stdout.replace(/\n$/, "");
  }

  private async write(service: string, blob: string, label: string): Promise<void> {
    const res = await runSecurity([
      "add-generic-password", "-U",
      "-s", service,
      "-a", this.account,
      "-w", blob,
      "-l", label,
    ]);
    if (res.code !== 0) {
      throw new Error(`security add-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
    }
  }
}
