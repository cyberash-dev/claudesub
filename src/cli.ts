#!/usr/bin/env node
import { userInfo } from "node:os";
import {
  EXIT_OK,
  EXIT_RUNTIME,
  EXIT_USAGE,
  type CliExitCode,
} from "./shared/domain/CliExitCode.js";
import { resolveCsmPaths } from "./shared/domain/CsmPaths.js";
import { selectAdapters } from "./shared/domain/PlatformDispatch.js";

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
import { NodeSaveProfileRepository } from "./features/save/adapters/outbound/NodeSaveProfileRepository.js";
import { NodeSaveActiveMarker } from "./features/save/adapters/outbound/NodeSaveActiveMarker.js";
import { NodeSaveClaudeJsonReader } from "./features/save/adapters/outbound/NodeSaveClaudeJsonReader.js";
import { SystemSaveClock } from "./features/save/adapters/outbound/SystemSaveClock.js";

import { SwitchProfile } from "./features/use/application/SwitchProfile.js";
import { CliUseHandler } from "./features/use/adapters/inbound/CliUseHandler.js";
import { NodeUseProfileRepository } from "./features/use/adapters/outbound/NodeUseProfileRepository.js";
import { NodeUseActiveMarker } from "./features/use/adapters/outbound/NodeUseActiveMarker.js";
import { NodeUseClaudeJsonWriter } from "./features/use/adapters/outbound/NodeUseClaudeJsonWriter.js";
import { ChildProcessUseAuthVerifier } from "./features/use/adapters/outbound/ChildProcessUseAuthVerifier.js";
import { SystemUseClock } from "./features/use/adapters/outbound/SystemUseClock.js";

import { RemoveProfile } from "./features/rm/application/RemoveProfile.js";
import { CliRmHandler } from "./features/rm/adapters/inbound/CliRmHandler.js";
import { NodeRmProfileRepository } from "./features/rm/adapters/outbound/NodeRmProfileRepository.js";
import { NodeRmActiveMarker } from "./features/rm/adapters/outbound/NodeRmActiveMarker.js";
import { StdioRmConfirmer } from "./features/rm/adapters/outbound/StdioRmConfirmer.js";

import { RenameProfile } from "./features/rename/application/RenameProfile.js";
import { CliRenameHandler } from "./features/rename/adapters/inbound/CliRenameHandler.js";
import { NodeRenameProfileRepository } from "./features/rename/adapters/outbound/NodeRenameProfileRepository.js";
import { NodeRenameActiveMarker } from "./features/rename/adapters/outbound/NodeRenameActiveMarker.js";

import { AddProfile } from "./features/add/application/AddProfile.js";
import { CliAddHandler } from "./features/add/adapters/inbound/CliAddHandler.js";
import { ChildProcessAddLogout } from "./features/add/adapters/outbound/ChildProcessAddLogout.js";
import { StdioAddPrompt } from "./features/add/adapters/outbound/StdioAddPrompt.js";

import { ExportProfiles } from "./features/export/application/ExportProfiles.js";
import { CliExportHandler } from "./features/export/adapters/inbound/CliExportHandler.js";
import { NodeExportProfileRepository } from "./features/export/adapters/outbound/NodeExportProfileRepository.js";
import { StdioExportPassphrasePrompt } from "./features/export/adapters/outbound/StdioExportPassphrasePrompt.js";
import { NodeExportFileWriter } from "./features/export/adapters/outbound/NodeExportFileWriter.js";
import { NodeCryptoExportCipher } from "./features/export/adapters/outbound/NodeCryptoExportCipher.js";
import { SystemExportClock } from "./features/export/adapters/outbound/SystemExportClock.js";

import { ImportProfiles } from "./features/import/application/ImportProfiles.js";
import { CliImportHandler } from "./features/import/adapters/inbound/CliImportHandler.js";
import { NodeImportProfileRepository } from "./features/import/adapters/outbound/NodeImportProfileRepository.js";
import { StdioImportPassphrasePrompt } from "./features/import/adapters/outbound/StdioImportPassphrasePrompt.js";
import { NodeImportFileReader } from "./features/import/adapters/outbound/NodeImportFileReader.js";
import { NodeCryptoImportCipher } from "./features/import/adapters/outbound/NodeCryptoImportCipher.js";
import { NodeImportActiveMarker } from "./features/import/adapters/outbound/NodeImportActiveMarker.js";

const HELP = `claudesub — switch between Claude Code OAuth subscriptions.

Usage:
  claudesub list [--json]
  claudesub status [--json]
  claudesub save <name> [--overwrite]
  claudesub use <name> [--force] [--no-verify]
  claudesub rename <old> <new>
  claudesub rm <name> [--yes]
  claudesub add <name>
  claudesub export <file>
  claudesub import <file> [--overwrite] [--overwrite-active]
  claudesub --help | --version

Profiles are stored in your OS credential store and the metadata file
~/.claude-subscription-manager/profiles.json. The credential-store
backend is selected at runtime by your OS:
  - macOS:   Keychain (service "Claude Code-credentials.profile.<name>", via /usr/bin/security)
  - Linux:   ~/.claude-subscription-manager/keychain/<name>.json (mode 0600), live store at ~/.claude/.credentials.json
  - Windows: Credential Manager target "Claude Code-credentials.profile.<name>" (via PowerShell + advapi32)
The active profile is recorded in ~/.claude-subscription-manager/active.

Notes:
  - "use" auto-snapshots the currently active profile first to capture rotated refresh tokens.
  - "use" refuses if any "claude" process is running (override with --force).
  - On macOS, token blobs are passed to /usr/bin/security via argv; they are briefly visible in \`ps\` for the calling user only. On Linux they live as plaintext at the file paths above (matching how Claude Code itself stores them on Linux). On Windows they are written to Credential Manager via PowerShell stdin (never argv).
  - Windows: run from PowerShell or cmd.exe — MSYS / Git Bash cannot reach Credential Manager (claude-code#29049).
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
  const account = userInfo().username;
  const paths = resolveCsmPaths();
  const adapters = selectAdapters(process.platform, account, paths);

  const listCmd = new ListProfiles(
    new NodeListProfileRepository(paths.profilesPath),
    new NodeListActiveMarker(paths.markerPath),
  );

  const statusCmd = new GetStatus(
    new NodeStatusProfileRepository(paths.profilesPath),
    new NodeStatusActiveMarker(paths.markerPath),
    new NodeStatusClaudeJsonReader(paths.claudeJsonPath),
    new ChildProcessStatusAuthInspector(),
  );

  const saveCmd = new SaveProfile(
    adapters.saveStore,
    new NodeSaveProfileRepository(paths.stateDir, paths.profilesPath),
    new NodeSaveActiveMarker(paths.stateDir, paths.markerPath),
    new NodeSaveClaudeJsonReader(paths.claudeJsonPath),
    new SystemSaveClock(),
  );

  const useCmd = new SwitchProfile(
    adapters.useStore,
    new NodeUseProfileRepository(paths.stateDir, paths.profilesPath),
    new NodeUseActiveMarker(paths.stateDir, paths.markerPath),
    new NodeUseClaudeJsonWriter(paths.claudeJsonPath),
    adapters.processInspector,
    new ChildProcessUseAuthVerifier(),
    new SystemUseClock(),
    {
      onAutoSnapshotWarning: (w) => {
        process.stderr.write(`Warning: failed to auto-snapshot active profile "${w.profileName}": ${w.reason}\n`);
      },
    },
  );

  const rmCmd = new RemoveProfile(
    adapters.rmStore,
    new NodeRmProfileRepository(paths.stateDir, paths.profilesPath),
    new NodeRmActiveMarker(paths.markerPath),
    new StdioRmConfirmer(),
  );

  const renameCmd = new RenameProfile(
    adapters.renameStore,
    new NodeRenameProfileRepository(paths.stateDir, paths.profilesPath),
    new NodeRenameActiveMarker(paths.stateDir, paths.markerPath),
  );

  const addCmd = new AddProfile(
    new ChildProcessAddLogout(),
    new StdioAddPrompt(),
    { snapshot: (name) => saveCmd.execute({ name, overwrite: true }).then(() => undefined) },
  );

  const exportCmd = new ExportProfiles(
    new NodeExportProfileRepository(paths.profilesPath),
    adapters.exportStore,
    new StdioExportPassphrasePrompt(),
    new NodeExportFileWriter(),
    new NodeCryptoExportCipher(),
    new SystemExportClock(),
  );

  const importCmd = new ImportProfiles(
    new NodeImportProfileRepository(paths.stateDir, paths.profilesPath),
    adapters.importStore,
    new StdioImportPassphrasePrompt(),
    new NodeImportFileReader(),
    new NodeCryptoImportCipher(),
    new NodeImportActiveMarker(paths.markerPath),
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
    process.stdout.write("claudesub 0.1.0\n");
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
