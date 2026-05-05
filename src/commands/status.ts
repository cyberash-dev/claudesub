import { spawn } from "node:child_process";
import { readClaudeJson } from "../claudeJson.js";
import { findProfile, readActive, readProfiles } from "../store.js";

export interface StatusOptions {
  json: boolean;
}

interface AuthStatus {
  loggedIn?: boolean;
  authMethod?: string;
  apiProvider?: string;
  email?: string;
  orgId?: string;
  orgName?: string;
  subscriptionType?: string;
  raw?: string;
  error?: string;
}

export async function runStatus(opts: StatusOptions): Promise<number> {
  const active = await readActive();
  const file = await readProfiles();
  const profile = active ? findProfile(file, active) : undefined;
  const claudeView = await readClaudeJson().catch(() => undefined);
  const desyncedReason = computeDesyncedReason(profile, claudeView);

  const auth = await fetchClaudeAuthStatus();

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      active,
      profileKnown: Boolean(profile),
      claudeJson: claudeView ? {
        userID: claudeView.userID,
        accountUuid: (claudeView.oauthAccount as Record<string, unknown> | undefined)?.accountUuid,
        emailAddress: (claudeView.oauthAccount as Record<string, unknown> | undefined)?.emailAddress,
      } : null,
      desynced: desyncedReason ? { reason: desyncedReason } : null,
      authStatus: auth,
    }, null, 2) + "\n");
    return 0;
  }

  if (active) {
    process.stdout.write(`Active profile: ${active}${profile ? "" : " (not in profiles.json — desynced)"}\n`);
  } else {
    process.stdout.write("Active profile: <none recorded>\n");
  }
  if (auth.error) {
    process.stdout.write(`claude auth status: error — ${auth.error}\n`);
  } else {
    process.stdout.write(`claude auth status: loggedIn=${auth.loggedIn ?? false} email=${auth.email ?? "?"} plan=${auth.subscriptionType ?? "?"}\n`);
  }
  if (desyncedReason) {
    process.stdout.write(`WARNING: ${desyncedReason}\n`);
  }
  return 0;
}

function computeDesyncedReason(
  profile: { oauthAccount: Record<string, unknown> } | undefined,
  view: { oauthAccount: Record<string, unknown> | undefined } | undefined,
): string | null {
  if (!profile || !view?.oauthAccount) return null;
  const expected = profile.oauthAccount.accountUuid;
  const actual = view.oauthAccount.accountUuid;
  if (typeof expected !== "string" || typeof actual !== "string") return null;
  if (expected !== actual) {
    return `~/.claude.json accountUuid (${actual}) does not match active profile's recorded accountUuid (${expected}).`;
  }
  return null;
}

function fetchClaudeAuthStatus(): Promise<AuthStatus> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["auth", "status", "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", (err) => resolve({ error: err.message }));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ error: `exit ${code}: ${stderr.trim() || stdout.trim()}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as AuthStatus;
        resolve(parsed);
      } catch (err) {
        resolve({ error: `parse failed: ${(err as Error).message}`, raw: stdout });
      }
    });
  });
}
