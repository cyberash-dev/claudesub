// Maps the macOS-style service name "Claude Code-credentials.profile.<name>"
// to the Linux slot file basename "<name>.json".
//
// Linux profile slots are stored as separate JSON files under the slot
// directory; the service-name string flowing through the cross-platform
// per-feature ports stays identical to macOS, so each feature's
// outbound adapter resolves the basename right before touching the file.
const PROFILE_SERVICE_PREFIX = "Claude Code-credentials.profile.";

export function serviceToProfileFileName(service: string): string {
  if (!service.startsWith(PROFILE_SERVICE_PREFIX)) {
    throw new Error(`Unexpected profile service name: ${service}`);
  }
  return `${service.slice(PROFILE_SERVICE_PREFIX.length)}.json`;
}
