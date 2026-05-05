export const LIVE_KEYCHAIN_SERVICE = "Claude Code-credentials";
export const PROFILE_KEYCHAIN_SERVICE_PREFIX = "Claude Code-credentials.profile.";

export function profileKeychainService(name: string): string {
  return PROFILE_KEYCHAIN_SERVICE_PREFIX + name;
}
