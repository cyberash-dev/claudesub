import { createInterface } from "node:readline/promises";
import { deleteSecret, KeychainItemNotFound } from "../keychain.js";
import { profileService } from "../paths.js";
import {
  findProfile,
  readActive,
  readProfiles,
  removeProfile,
  writeActive,
  writeProfiles,
} from "../store.js";

export interface RmOptions {
  name: string;
  yes: boolean;
}

export async function runRm(opts: RmOptions): Promise<number> {
  const file = await readProfiles();
  if (!findProfile(file, opts.name)) {
    process.stderr.write(`Unknown profile "${opts.name}".\n`);
    return 1;
  }

  if (!opts.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`Delete profile "${opts.name}"? Type the name to confirm: `)).trim();
    rl.close();
    if (answer !== opts.name) {
      process.stderr.write("Aborted.\n");
      return 1;
    }
  }

  try {
    await deleteSecret(profileService(opts.name));
  } catch (err) {
    if (!(err instanceof KeychainItemNotFound)) throw err;
    process.stderr.write(`Warning: keychain entry for "${opts.name}" was already missing.\n`);
  }

  await writeProfiles(removeProfile(file, opts.name));
  const active = await readActive();
  if (active === opts.name) {
    await writeActive(null);
    process.stdout.write(`Removed "${opts.name}". Note: live keychain (${"Claude Code-credentials"}) was NOT touched.\n`);
  } else {
    process.stdout.write(`Removed "${opts.name}".\n`);
  }
  return 0;
}
