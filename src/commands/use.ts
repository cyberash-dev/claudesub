import { spawn } from "node:child_process";
import { patchClaudeJson } from "../claudeJson.js";
import { readSecret, writeSecret } from "../keychain.js";
import { liveKeychainService, profileService } from "../paths.js";
import { findRunningClaudeProcesses } from "../procCheck.js";
import {
  findProfile,
  readActive,
  readProfiles,
  upsertProfile,
  writeActive,
  writeProfiles,
} from "../store.js";

export interface UseOptions {
  name: string;
  force: boolean;
  noVerify: boolean;
}

export async function runUse(opts: UseOptions): Promise<number> {
  const file = await readProfiles();
  const target = findProfile(file, opts.name);
  if (!target) {
    process.stderr.write(`Unknown profile "${opts.name}". Run \`claude-sub list\` to see available profiles.\n`);
    return 1;
  }

  if (!opts.force) {
    const running = await findRunningClaudeProcesses();
    if (running.length > 0) {
      process.stderr.write("Refusing to switch: claude is currently running.\n");
      for (const r of running) {
        process.stderr.write(`  pid=${r.pid}  ${r.command}\n`);
      }
      process.stderr.write("Quit those sessions and retry, or pass --force.\n");
      return 1;
    }
  }

  const active = await readActive();
  if (active && active !== opts.name) {
    const activeProfile = findProfile(file, active);
    if (activeProfile) {
      try {
        const currentBlob = await readSecret(liveKeychainService);
        await writeSecret(
          profileService(active),
          currentBlob,
          `Claude Code subscription profile: ${active}`,
        );
        const refreshed = { ...activeProfile, lastUsedAt: new Date().toISOString() };
        await writeProfiles(upsertProfile(file, refreshed));
      } catch (err) {
        process.stderr.write(`Warning: failed to auto-snapshot active profile "${active}": ${(err as Error).message}\n`);
      }
    }
  }

  const targetBlob = await readSecret(profileService(opts.name));
  await writeSecret(liveKeychainService, targetBlob, "Claude Code-credentials");
  await patchClaudeJson(target.oauthAccount, target.userID);

  const updated = { ...target, lastUsedAt: new Date().toISOString() };
  const fileAfter = await readProfiles();
  await writeProfiles(upsertProfile(fileAfter, updated));
  await writeActive(opts.name);

  process.stdout.write(`Switched to "${opts.name}" (${target.email || "no email"}).\n`);

  if (!opts.noVerify) {
    const verdict = await verifyClaudeAuthStatus();
    if (verdict.ok) {
      process.stdout.write(`claude auth status: ${verdict.summary}\n`);
    } else {
      process.stderr.write(`claude auth status check failed: ${verdict.summary}\n`);
      return 1;
    }
  }
  return 0;
}

interface VerifyResult { ok: boolean; summary: string }

function verifyClaudeAuthStatus(): Promise<VerifyResult> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["auth", "status", "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", (err) => resolve({ ok: false, summary: `cannot exec claude: ${err.message}` }));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, summary: `exit ${code}: ${stderr.trim() || stdout.trim()}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { loggedIn?: boolean; email?: string; subscriptionType?: string };
        if (!parsed.loggedIn) {
          resolve({ ok: false, summary: "loggedIn=false" });
          return;
        }
        resolve({ ok: true, summary: `loggedIn as ${parsed.email ?? "?"} (${parsed.subscriptionType ?? "?"})` });
      } catch (err) {
        resolve({ ok: false, summary: `cannot parse: ${(err as Error).message}` });
      }
    });
  });
}
