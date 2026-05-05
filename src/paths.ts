import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();

export const claudeJsonPath = join(home, ".claude.json");
export const stateDir = join(home, ".claude-subscription-manager");
export const profilesPath = join(stateDir, "profiles.json");
export const activePath = join(stateDir, "active");

export const liveKeychainService = "Claude Code-credentials";
export const profileServicePrefix = "Claude Code-credentials.profile.";

export function profileService(name: string): string {
  return profileServicePrefix + name;
}
