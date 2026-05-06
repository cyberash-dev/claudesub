import type { SaveCredentialStore } from "../../features/save/ports/outbound/SaveCredentialStore.js";
import type { UseCredentialStore } from "../../features/use/ports/outbound/UseCredentialStore.js";
import type { RmCredentialStore } from "../../features/rm/ports/outbound/RmCredentialStore.js";
import type { RenameCredentialStore } from "../../features/rename/ports/outbound/RenameCredentialStore.js";
import type { ExportCredentialStore } from "../../features/export/ports/outbound/ExportCredentialStore.js";
import type { ImportCredentialStore } from "../../features/import/ports/outbound/ImportCredentialStore.js";
import type { UseProcessInspector } from "../../features/use/ports/outbound/UseProcessInspector.js";
import { LIVE_KEYCHAIN_SERVICE } from "../domain/ServiceNames.js";

import { ChildProcessSaveCredentialStore } from "../../features/save/adapters/outbound/ChildProcessSaveCredentialStore.js";
import { ChildProcessUseCredentialStore } from "../../features/use/adapters/outbound/ChildProcessUseCredentialStore.js";
import { ChildProcessRmCredentialStore } from "../../features/rm/adapters/outbound/ChildProcessRmCredentialStore.js";
import { ChildProcessRenameCredentialStore } from "../../features/rename/adapters/outbound/ChildProcessRenameCredentialStore.js";
import { ChildProcessExportCredentialStore } from "../../features/export/adapters/outbound/ChildProcessExportCredentialStore.js";
import { ChildProcessImportCredentialStore } from "../../features/import/adapters/outbound/ChildProcessImportCredentialStore.js";
import { ChildProcessUseProcessInspector } from "../../features/use/adapters/outbound/ChildProcessUseProcessInspector.js";

import { LinuxFileSaveCredentialStore } from "../../features/save/adapters/outbound/LinuxFileSaveCredentialStore.js";
import { LinuxFileUseCredentialStore } from "../../features/use/adapters/outbound/LinuxFileUseCredentialStore.js";
import { LinuxFileRmCredentialStore } from "../../features/rm/adapters/outbound/LinuxFileRmCredentialStore.js";
import { LinuxFileRenameCredentialStore } from "../../features/rename/adapters/outbound/LinuxFileRenameCredentialStore.js";
import { LinuxFileExportCredentialStore } from "../../features/export/adapters/outbound/LinuxFileExportCredentialStore.js";
import { LinuxFileImportCredentialStore } from "../../features/import/adapters/outbound/LinuxFileImportCredentialStore.js";
import { ProcFsUseProcessInspector } from "../../features/use/adapters/outbound/ProcFsUseProcessInspector.js";

import { WindowsCmSaveCredentialStore } from "../../features/save/adapters/outbound/WindowsCmSaveCredentialStore.js";
import { WindowsCmUseCredentialStore } from "../../features/use/adapters/outbound/WindowsCmUseCredentialStore.js";
import { WindowsCmRmCredentialStore } from "../../features/rm/adapters/outbound/WindowsCmRmCredentialStore.js";
import { WindowsCmRenameCredentialStore } from "../../features/rename/adapters/outbound/WindowsCmRenameCredentialStore.js";
import { WindowsCmExportCredentialStore } from "../../features/export/adapters/outbound/WindowsCmExportCredentialStore.js";
import { WindowsCmImportCredentialStore } from "../../features/import/adapters/outbound/WindowsCmImportCredentialStore.js";
import { WindowsTasklistUseProcessInspector } from "../../features/use/adapters/outbound/WindowsTasklistUseProcessInspector.js";

import type { CsmPaths } from "./CsmPaths.js";

export interface PlatformAdapters {
  saveStore: SaveCredentialStore;
  useStore: UseCredentialStore;
  rmStore: RmCredentialStore;
  renameStore: RenameCredentialStore;
  exportStore: ExportCredentialStore;
  importStore: ImportCredentialStore;
  processInspector: UseProcessInspector;
}

export type SupportedPlatform = "darwin" | "linux" | "win32";

export function selectAdapters(
  platform: NodeJS.Platform,
  account: string,
  paths: CsmPaths,
): PlatformAdapters {
  switch (platform) {
    case "darwin": return darwinAdapters(account);
    case "linux":  return linuxAdapters(paths);
    case "win32":  return win32Adapters(account);
    default:
      throw new UnsupportedPlatformError(platform);
  }
}

export class UnsupportedPlatformError extends Error {
  constructor(platform: NodeJS.Platform) {
    super(
      `Unsupported platform: ${platform}. ` +
      `claudesub runs on macOS (darwin), Linux, and Windows (win32) only.`,
    );
    this.name = "UnsupportedPlatformError";
  }
}

function darwinAdapters(account: string): PlatformAdapters {
  return {
    saveStore: new ChildProcessSaveCredentialStore(account, LIVE_KEYCHAIN_SERVICE),
    useStore: new ChildProcessUseCredentialStore(account, LIVE_KEYCHAIN_SERVICE),
    rmStore: new ChildProcessRmCredentialStore(account),
    renameStore: new ChildProcessRenameCredentialStore(account),
    exportStore: new ChildProcessExportCredentialStore(account),
    importStore: new ChildProcessImportCredentialStore(account),
    processInspector: new ChildProcessUseProcessInspector(),
  };
}

function linuxAdapters(paths: CsmPaths): PlatformAdapters {
  return {
    saveStore: new LinuxFileSaveCredentialStore(paths.linuxLiveCredentialsPath, paths.linuxSlotDir),
    useStore: new LinuxFileUseCredentialStore(paths.linuxLiveCredentialsPath, paths.linuxSlotDir),
    rmStore: new LinuxFileRmCredentialStore(paths.linuxSlotDir),
    renameStore: new LinuxFileRenameCredentialStore(paths.linuxSlotDir),
    exportStore: new LinuxFileExportCredentialStore(paths.linuxSlotDir),
    importStore: new LinuxFileImportCredentialStore(paths.linuxSlotDir),
    processInspector: new ProcFsUseProcessInspector(),
  };
}

function win32Adapters(account: string): PlatformAdapters {
  return {
    saveStore: new WindowsCmSaveCredentialStore(account, LIVE_KEYCHAIN_SERVICE),
    useStore: new WindowsCmUseCredentialStore(account, LIVE_KEYCHAIN_SERVICE),
    rmStore: new WindowsCmRmCredentialStore(),
    renameStore: new WindowsCmRenameCredentialStore(account),
    exportStore: new WindowsCmExportCredentialStore(),
    importStore: new WindowsCmImportCredentialStore(account),
    processInspector: new WindowsTasklistUseProcessInspector(),
  };
}
