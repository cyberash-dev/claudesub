import { spawn } from "node:child_process";
import { userInfo } from "node:os";

const account = userInfo().username;

interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runSecurity(args: string[]): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/security", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export class KeychainItemNotFound extends Error {
  constructor(service: string) {
    super(`Keychain item not found: service=${service} account=${account}`);
    this.name = "KeychainItemNotFound";
  }
}

export async function readSecret(service: string): Promise<string> {
  const res = await runSecurity(["find-generic-password", "-s", service, "-a", account, "-w"]);
  if (res.code === 44) throw new KeychainItemNotFound(service);
  if (res.code !== 0) {
    throw new Error(`security find-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
  return res.stdout.replace(/\n$/, "");
}

export async function writeSecret(service: string, value: string, label?: string): Promise<void> {
  const args = [
    "add-generic-password",
    "-U",
    "-s", service,
    "-a", account,
    "-w", value,
  ];
  if (label) args.push("-l", label);
  const res = await runSecurity(args);
  if (res.code !== 0) {
    throw new Error(`security add-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
}

export async function deleteSecret(service: string): Promise<void> {
  const res = await runSecurity(["delete-generic-password", "-s", service, "-a", account]);
  if (res.code === 44) throw new KeychainItemNotFound(service);
  if (res.code !== 0) {
    throw new Error(`security delete-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
}

export async function hasSecret(service: string): Promise<boolean> {
  const res = await runSecurity(["find-generic-password", "-s", service, "-a", account]);
  if (res.code === 44) return false;
  if (res.code !== 0) {
    throw new Error(`security find-generic-password failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
  return true;
}
