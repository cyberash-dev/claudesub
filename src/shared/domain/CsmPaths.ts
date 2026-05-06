import { homedir } from "node:os";
import { join } from "node:path";

export interface CsmPaths {
  home: string;
  stateDir: string;
  profilesPath: string;
  markerPath: string;
  claudeJsonPath: string;
  linuxLiveCredentialsPath: string;
  linuxSlotDir: string;
}

export function resolveCsmPaths(): CsmPaths {
  const home = homedir();
  const stateDir = join(home, ".claude-subscription-manager");
  return {
    home,
    stateDir,
    profilesPath: join(stateDir, "profiles.json"),
    markerPath: join(stateDir, "active"),
    claudeJsonPath: join(home, ".claude.json"),
    linuxLiveCredentialsPath: join(home, ".claude", ".credentials.json"),
    linuxSlotDir: join(stateDir, "keychain"),
  };
}
