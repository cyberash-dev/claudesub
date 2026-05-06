#!/usr/bin/env node
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "./shared/domain/CliExitCode.js";
import { LIVE_KEYCHAIN_SERVICE } from "./shared/domain/ServiceNames.js";

import { ListProfiles } from "./features/list/application/ListProfiles.js";
import { CliListHandler } from "./features/list/adapters/inbound/CliListHandler.js";
import { NodeListProfileRepository } from "./features/list/adapters/outbound/NodeListProfileRepository.js";
import { NodeListActiveMarker } from "./features/list/adapters/outbound/NodeListActiveMarker.js";

import { GetStatus } from "./features/status/application/GetStatus.js";
import { CliStatusHandler } from "./features/status/adapters/inbound/CliStatusHandler.js";
import { NodeStatusProfileRepository } from "./features/status/adapters/outbound/NodeStatusProfileRepository.js";
import { NodeStatusActiveMarker } from "./features/status/adapters/outbound/NodeStatusActiveMarker.js";
import { NodeStatusClaudeJsonReader } from "./features/status/adapters/outbound/NodeStatusClaudeJsonReader.js";
import { ChildProcessStatusAuthInspector } from "./features/status/adapters/outbound/ChildProcessStatusAuthInspector.js";

import { SaveProfile } from "./features/save/application/SaveProfile.js";
import { CliSaveHandler } from "./features/save/adapters/inbound/CliSaveHandler.js";
import { ChildProcessSaveCredentialStore } from "./features/save/adapters/outbound/ChildProcessSaveCredentialStore.js";
import { NodeSaveProfileRepository } from "./features/save/adapters/outbound/NodeSaveProfileRepository.js";
import { NodeSaveActiveMarker } from "./features/save/adapters/outbound/NodeSaveActiveMarker.js";
import { NodeSaveClaudeJsonReader } from "./features/save/adapters/outbound/NodeSaveClaudeJsonReader.js";
import { SystemSaveClock } from "./features/save/adapters/outbound/SystemSaveClock.js";

import { SwitchProfile } from "./features/use/application/SwitchProfile.js";
import { CliUseHandler } from "./features/use/adapters/inbound/CliUseHandler.js";
import { ChildProcessUseCredentialStore } from "./features/use/adapters/outbound/ChildProcessUseCredentialStore.js";
import { NodeUseProfileRepository } from "./features/use/adapters/outbound/NodeUseProfileRepository.js";
import { NodeUseActiveMarker } from "./features/use/adapters/outbound/NodeUseActiveMarker.js";
import { NodeUseClaudeJsonWriter } from "./features/use/adapters/outbound/NodeUseClaudeJsonWriter.js";
import { ChildProcessUseProcessInspector } from "./features/use/adapters/outbound/ChildProcessUseProcessInspector.js";
import { ChildProcessUseAuthVerifier } from "./features/use/adapters/outbound/ChildProcessUseAuthVerifier.js";
import { SystemUseClock } from "./features/use/adapters/outbound/SystemUseClock.js";

import { RemoveProfile } from "./features/rm/application/RemoveProfile.js";
import { CliRmHandler } from "./features/rm/adapters/inbound/CliRmHandler.js";
import { ChildProcessRmCredentialStore } from "./features/rm/adapters/outbound/ChildProcessRmCredentialStore.js";
import { NodeRmProfileRepository } from "./features/rm/adapters/outbound/NodeRmProfileRepository.js";
import { NodeRmActiveMarker } from "./features/rm/adapters/outbound/NodeRmActiveMarker.js";
import { StdioRmConfirmer } from "./features/rm/adapters/outbound/StdioRmConfirmer.js";

import { RenameProfile } from "./features/rename/application/RenameProfile.js";
import { CliRenameHandler } from "./features/rename/adapters/inbound/CliRenameHandler.js";
import { ChildProcessRenameCredentialStore } from "./features/rename/adapters/outbound/ChildProcessRenameCredentialStore.js";
import { NodeRenameProfileRepository } from "./features/rename/adapters/outbound/NodeRenameProfileRepository.js";
import { NodeRenameActiveMarker } from "./features/rename/adapters/outbound/NodeRenameActiveMarker.js";

import { AddProfile } from "./features/add/application/AddProfile.js";
import { CliAddHandler } from "./features/add/adapters/inbound/CliAddHandler.js";
import { ChildProcessAddLogout } from "./features/add/adapters/outbound/ChildProcessAddLogout.js";
import { StdioAddPrompt } from "./features/add/adapters/outbound/StdioAddPrompt.js";

import { ExportProfiles } from "./features/export/application/ExportProfiles.js";
import { CliExportHandler } from "./features/export/adapters/inbound/CliExportHandler.js";
import { NodeExportProfileRepository } from "./features/export/adapters/outbound/NodeExportProfileRepository.js";
import { ChildProcessExportCredentialStore } from "./features/export/adapters/outbound/ChildProcessExportCredentialStore.js";
import { StdioExportPassphrasePrompt } from "./features/export/adapters/outbound/StdioExportPassphrasePrompt.js";
import { NodeExportFileWriter } from "./features/export/adapters/outbound/NodeExportFileWriter.js";
import { NodeCryptoExportCipher } from "./features/export/adapters/outbound/NodeCryptoExportCipher.js";
import { SystemExportClock } from "./features/export/adapters/outbound/SystemExportClock.js";

import { ImportProfiles } from "./features/import/application/ImportProfiles.js";
import { CliImportHandler } from "./features/import/adapters/inbound/CliImportHandler.js";
import { NodeImportProfileRepository } from "./features/import/adapters/outbound/NodeImportProfileRepository.js";
import { ChildProcessImportCredentialStore } from "./features/import/adapters/outbound/ChildProcessImportCredentialStore.js";
import { StdioImportPassphrasePrompt } from "./features/import/adapters/outbound/StdioImportPassphrasePrompt.js";
import { NodeImportFileReader } from "./features/import/adapters/outbound/NodeImportFileReader.js";
import { NodeCryptoImportCipher } from "./features/import/adapters/outbound/NodeCryptoImportCipher.js";
import { NodeImportActiveMarker } from "./features/import/adapters/outbound/NodeImportActiveMarker.js";

const HELP = `claude-sub — switch between Claude Code OAuth subscriptions on macOS.

Usage:
  claude-sub list [--json]
  claude-sub status [--json]
  claude-sub save <name> [--overwrite]
  claude-sub use <name> [--force] [--no-verify]
  claude-sub rename <old> <new>
  claude-sub rm <name> [--yes]
  claude-sub add <name>
  claude-sub export <file>
  claude-sub import <file> [--overwrite] [--overwrite-active]
  claude-sub --help | --version

Profiles are stored as macOS Keychain items (service "Claude Code-credentials.profile.<name>")
plus non-secret metadata in ~/.claude-subscription-manager/profiles.json.
The active profile is recorded in ~/.claude-subscription-manager/active.

Notes:
  - "use" auto-snapshots the currently active profile first to capture rotated refresh tokens.
  - "use" refuses if any "claude" process is running (override with --force).
  - Token blobs are passed to /usr/bin/security via argv; they are briefly visible in \`ps\` for the calling user only.
  - "export" writes an encrypted bundle (AES-256-GCM with a passphrase-derived key) to <file>; the passphrase is prompted twice and never persisted.
  - "import" prompts for the passphrase once. By default it skips profiles that already exist; --overwrite replaces them, and --overwrite-active is required to overwrite the currently active profile.
`;

interface Wired {
  list: CliListHandler;
  status: CliStatusHandler;
  save: CliSaveHandler;
  use: CliUseHandler;
  rm: CliRmHandler;
  rename: CliRenameHandler;
  add: CliAddHandler;
  export: CliExportHandler;
  import: CliImportHandler;
}

function wire(): Wired {
  const home = homedir();
  const account = userInfo().username;
  const stateDir = join(home, ".claude-subscription-manager");
  const profilesPath = join(stateDir, "profiles.json");
  const markerPath = join(stateDir, "active");
  const claudeJsonPath = join(home, ".claude.json");

  const listCmd = new ListProfiles(
    new NodeListProfileRepository(profilesPath),
    new NodeListActiveMarker(markerPath),
  );

  const statusCmd = new GetStatus(
    new NodeStatusProfileRepository(profilesPath),
    new NodeStatusActiveMarker(markerPath),
    new NodeStatusClaudeJsonReader(claudeJsonPath),
    new ChildProcessStatusAuthInspector(),
  );

  const saveCmd = new SaveProfile(
    new ChildProcessSaveCredentialStore(account, LIVE_KEYCHAIN_SERVICE),
    new NodeSaveProfileRepository(stateDir, profilesPath),
    new NodeSaveActiveMarker(stateDir, markerPath),
    new NodeSaveClaudeJsonReader(claudeJsonPath),
    new SystemSaveClock(),
  );

  const useCmd = new SwitchProfile(
    new ChildProcessUseCredentialStore(account, LIVE_KEYCHAIN_SERVICE),
    new NodeUseProfileRepository(stateDir, profilesPath),
    new NodeUseActiveMarker(stateDir, markerPath),
    new NodeUseClaudeJsonWriter(claudeJsonPath),
    new ChildProcessUseProcessInspector(),
    new ChildProcessUseAuthVerifier(),
    new SystemUseClock(),
    {
      onAutoSnapshotWarning: (w) => {
        process.stderr.write(`Warning: failed to auto-snapshot active profile "${w.profileName}": ${w.reason}\n`);
      },
    },
  );

  const rmCmd = new RemoveProfile(
    new ChildProcessRmCredentialStore(account),
    new NodeRmProfileRepository(stateDir, profilesPath),
    new NodeRmActiveMarker(markerPath),
    new StdioRmConfirmer(),
  );

  const renameCmd = new RenameProfile(
    new ChildProcessRenameCredentialStore(account),
    new NodeRenameProfileRepository(stateDir, profilesPath),
    new NodeRenameActiveMarker(stateDir, markerPath),
  );

  const addCmd = new AddProfile(
    new ChildProcessAddLogout(),
    new StdioAddPrompt(),
    { snapshot: (name) => saveCmd.execute({ name, overwrite: true }).then(() => undefined) },
  );

  const exportCmd = new ExportProfiles(
    new NodeExportProfileRepository(profilesPath),
    new ChildProcessExportCredentialStore(account),
    new StdioExportPassphrasePrompt(),
    new NodeExportFileWriter(),
    new NodeCryptoExportCipher(),
    new SystemExportClock(),
  );

  const importCmd = new ImportProfiles(
    new NodeImportProfileRepository(stateDir, profilesPath),
    new ChildProcessImportCredentialStore(account),
    new StdioImportPassphrasePrompt(),
    new NodeImportFileReader(),
    new NodeCryptoImportCipher(),
    new NodeImportActiveMarker(markerPath),
  );

  return {
    list: new CliListHandler(listCmd),
    status: new CliStatusHandler(statusCmd),
    save: new CliSaveHandler(saveCmd),
    use: new CliUseHandler(useCmd),
    rm: new CliRmHandler(rmCmd),
    rename: new CliRenameHandler(renameCmd),
    add: new CliAddHandler(addCmd),
    export: new CliExportHandler(exportCmd),
    import: new CliImportHandler(importCmd),
  };
}

async function main(argv: string[]): Promise<CliExitCode> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return EXIT_OK;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write("claude-sub 0.1.0\n");
    return EXIT_OK;
  }

  const handlers = wire();

  switch (command) {
    case "list":   return handlers.list.run(rest);
    case "status": return handlers.status.run(rest);
    case "save":   return handlers.save.run(rest);
    case "use":    return handlers.use.run(rest);
    case "rm":
    case "remove":
    case "delete": return handlers.rm.run(rest);
    case "rename":
    case "mv":     return handlers.rename.run(rest);
    case "add":    return handlers.add.run(rest);
    case "export": return handlers.export.run(rest);
    case "import": return handlers.import.run(rest);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return EXIT_USAGE;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(EXIT_RUNTIME);
  },
);
