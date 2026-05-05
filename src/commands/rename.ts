import { deleteSecret, readSecret, writeSecret } from "../keychain.js";
import { profileService } from "../paths.js";
import {
  findProfile,
  isValidProfileName,
  readActive,
  readProfiles,
  removeProfile,
  upsertProfile,
  writeActive,
  writeProfiles,
} from "../store.js";

export interface RenameOptions {
  oldName: string;
  newName: string;
}

export async function runRename(opts: RenameOptions): Promise<number> {
  if (!isValidProfileName(opts.newName)) {
    process.stderr.write(`Invalid new name: "${opts.newName}".\n`);
    return 2;
  }
  const file = await readProfiles();
  const profile = findProfile(file, opts.oldName);
  if (!profile) {
    process.stderr.write(`Unknown profile "${opts.oldName}".\n`);
    return 1;
  }
  if (findProfile(file, opts.newName)) {
    process.stderr.write(`Profile "${opts.newName}" already exists.\n`);
    return 1;
  }

  const blob = await readSecret(profileService(opts.oldName));
  await writeSecret(profileService(opts.newName), blob, `Claude Code subscription profile: ${opts.newName}`);
  await deleteSecret(profileService(opts.oldName));

  const renamed = { ...profile, name: opts.newName };
  const intermediate = removeProfile(file, opts.oldName);
  await writeProfiles(upsertProfile(intermediate, renamed));

  const active = await readActive();
  if (active === opts.oldName) await writeActive(opts.newName);

  process.stdout.write(`Renamed "${opts.oldName}" → "${opts.newName}".\n`);
  return 0;
}
