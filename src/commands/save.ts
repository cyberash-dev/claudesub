import { readClaudeJson } from "../claudeJson.js";
import { readSecret, writeSecret } from "../keychain.js";
import { liveKeychainService, profileService } from "../paths.js";
import {
  findProfile,
  isValidProfileName,
  readProfiles,
  upsertProfile,
  writeActive,
  writeProfiles,
} from "../store.js";
import type { ProfileMetadata } from "../types.js";

export interface SaveOptions {
  name: string;
  overwrite: boolean;
}

export async function runSave(opts: SaveOptions): Promise<number> {
  if (!isValidProfileName(opts.name)) {
    process.stderr.write(`Invalid profile name: "${opts.name}". Allowed: [a-zA-Z0-9._-], 1..64 chars.\n`);
    return 2;
  }

  const file = await readProfiles();
  if (findProfile(file, opts.name) && !opts.overwrite) {
    process.stderr.write(`Profile "${opts.name}" already exists. Pass --overwrite to replace it.\n`);
    return 1;
  }

  const view = await readClaudeJson();
  if (!view.oauthAccount || !view.userID) {
    process.stderr.write("~/.claude.json has no oauthAccount/userID — looks like you're not logged in. Run `claude auth login` first.\n");
    return 1;
  }

  const blob = await readSecret(liveKeychainService);
  await writeSecret(profileService(opts.name), blob, `Claude Code subscription profile: ${opts.name}`);

  const oa = view.oauthAccount as Record<string, unknown>;
  const now = new Date().toISOString();
  const profile: ProfileMetadata = {
    name: opts.name,
    oauthAccount: view.oauthAccount,
    userID: view.userID,
    email: typeof oa.emailAddress === "string" ? oa.emailAddress : "",
    orgName: typeof oa.organizationName === "string" ? oa.organizationName : "",
    subscriptionType: extractSubscriptionType(oa),
    createdAt: findProfile(file, opts.name)?.createdAt ?? now,
    lastUsedAt: now,
  };

  await writeProfiles(upsertProfile(file, profile));
  await writeActive(opts.name);

  process.stdout.write(`Saved profile "${opts.name}" (${profile.email || "no email"}, ${profile.subscriptionType || "unknown plan"}). Marked active.\n`);
  return 0;
}

function extractSubscriptionType(oa: Record<string, unknown>): string {
  for (const key of ["subscriptionType", "billingType", "seatTier"]) {
    const v = oa[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}
