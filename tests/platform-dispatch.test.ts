import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  selectAdapters,
  UnsupportedPlatformError,
} from "../src/shared/domain/PlatformDispatch.js";
import { resolveCsmPaths } from "../src/shared/domain/CsmPaths.js";

import { ChildProcessSaveCredentialStore } from "../src/features/save/adapters/outbound/ChildProcessSaveCredentialStore.js";
import { ChildProcessUseCredentialStore } from "../src/features/use/adapters/outbound/ChildProcessUseCredentialStore.js";
import { ChildProcessRmCredentialStore } from "../src/features/rm/adapters/outbound/ChildProcessRmCredentialStore.js";
import { ChildProcessRenameCredentialStore } from "../src/features/rename/adapters/outbound/ChildProcessRenameCredentialStore.js";
import { ChildProcessExportCredentialStore } from "../src/features/export/adapters/outbound/ChildProcessExportCredentialStore.js";
import { ChildProcessImportCredentialStore } from "../src/features/import/adapters/outbound/ChildProcessImportCredentialStore.js";
import { ChildProcessUseProcessInspector } from "../src/features/use/adapters/outbound/ChildProcessUseProcessInspector.js";

import { LinuxFileSaveCredentialStore } from "../src/features/save/adapters/outbound/LinuxFileSaveCredentialStore.js";
import { LinuxFileUseCredentialStore } from "../src/features/use/adapters/outbound/LinuxFileUseCredentialStore.js";
import { LinuxFileRmCredentialStore } from "../src/features/rm/adapters/outbound/LinuxFileRmCredentialStore.js";
import { LinuxFileRenameCredentialStore } from "../src/features/rename/adapters/outbound/LinuxFileRenameCredentialStore.js";
import { LinuxFileExportCredentialStore } from "../src/features/export/adapters/outbound/LinuxFileExportCredentialStore.js";
import { LinuxFileImportCredentialStore } from "../src/features/import/adapters/outbound/LinuxFileImportCredentialStore.js";
import { ProcFsUseProcessInspector } from "../src/features/use/adapters/outbound/ProcFsUseProcessInspector.js";

import { WindowsCmSaveCredentialStore } from "../src/features/save/adapters/outbound/WindowsCmSaveCredentialStore.js";
import { WindowsCmUseCredentialStore } from "../src/features/use/adapters/outbound/WindowsCmUseCredentialStore.js";
import { WindowsCmRmCredentialStore } from "../src/features/rm/adapters/outbound/WindowsCmRmCredentialStore.js";
import { WindowsCmRenameCredentialStore } from "../src/features/rename/adapters/outbound/WindowsCmRenameCredentialStore.js";
import { WindowsCmExportCredentialStore } from "../src/features/export/adapters/outbound/WindowsCmExportCredentialStore.js";
import { WindowsCmImportCredentialStore } from "../src/features/import/adapters/outbound/WindowsCmImportCredentialStore.js";
import { WindowsTasklistUseProcessInspector } from "../src/features/use/adapters/outbound/WindowsTasklistUseProcessInspector.js";

const PATHS = resolveCsmPaths();
const ACCOUNT = "test-user";

describe("CST-001 platform dispatch", () => {
  // @covers csm:CST-001
  // @covers csm:DELTA-005
  test("darwin selects ChildProcess (security/pgrep) adapter set", () => {
    const a = selectAdapters("darwin", ACCOUNT, PATHS);
    assert.ok(a.saveStore instanceof ChildProcessSaveCredentialStore);
    assert.ok(a.useStore instanceof ChildProcessUseCredentialStore);
    assert.ok(a.rmStore instanceof ChildProcessRmCredentialStore);
    assert.ok(a.renameStore instanceof ChildProcessRenameCredentialStore);
    assert.ok(a.exportStore instanceof ChildProcessExportCredentialStore);
    assert.ok(a.importStore instanceof ChildProcessImportCredentialStore);
    assert.ok(a.processInspector instanceof ChildProcessUseProcessInspector);
  });

  // @covers csm:CST-001
  // @covers csm:EXT-006
  // @covers csm:EXT-008
  test("linux selects LinuxFile + ProcFs adapter set", () => {
    const a = selectAdapters("linux", ACCOUNT, PATHS);
    assert.ok(a.saveStore instanceof LinuxFileSaveCredentialStore);
    assert.ok(a.useStore instanceof LinuxFileUseCredentialStore);
    assert.ok(a.rmStore instanceof LinuxFileRmCredentialStore);
    assert.ok(a.renameStore instanceof LinuxFileRenameCredentialStore);
    assert.ok(a.exportStore instanceof LinuxFileExportCredentialStore);
    assert.ok(a.importStore instanceof LinuxFileImportCredentialStore);
    assert.ok(a.processInspector instanceof ProcFsUseProcessInspector);
  });

  // @covers csm:CST-001
  // @covers csm:EXT-007
  // @covers csm:EXT-009
  test("win32 selects WindowsCm + Tasklist adapter set", () => {
    const a = selectAdapters("win32", ACCOUNT, PATHS);
    assert.ok(a.saveStore instanceof WindowsCmSaveCredentialStore);
    assert.ok(a.useStore instanceof WindowsCmUseCredentialStore);
    assert.ok(a.rmStore instanceof WindowsCmRmCredentialStore);
    assert.ok(a.renameStore instanceof WindowsCmRenameCredentialStore);
    assert.ok(a.exportStore instanceof WindowsCmExportCredentialStore);
    assert.ok(a.importStore instanceof WindowsCmImportCredentialStore);
    assert.ok(a.processInspector instanceof WindowsTasklistUseProcessInspector);
  });

  // @covers csm:CST-001
  test("freebsd is rejected with UnsupportedPlatformError", () => {
    assert.throws(
      () => selectAdapters("freebsd", ACCOUNT, PATHS),
      (err) => err instanceof UnsupportedPlatformError && /freebsd/.test(err.message),
    );
  });

  // @covers csm:CST-001
  test("aix and sunos are rejected", () => {
    assert.throws(() => selectAdapters("aix", ACCOUNT, PATHS), UnsupportedPlatformError);
    assert.throws(() => selectAdapters("sunos", ACCOUNT, PATHS), UnsupportedPlatformError);
  });
});

describe("CsmPaths derivation", () => {
  // @covers csm:CST-001
  test("resolveCsmPaths returns absolute paths anchored at homedir", () => {
    const p = resolveCsmPaths();
    assert.ok(p.home.length > 0);
    assert.ok(p.stateDir.endsWith(".claude-subscription-manager"));
    assert.ok(p.profilesPath.endsWith("profiles.json"));
    assert.ok(p.markerPath.endsWith("active"));
    assert.ok(p.claudeJsonPath.endsWith(".claude.json"));
    assert.ok(p.linuxLiveCredentialsPath.endsWith(".credentials.json"));
    assert.ok(p.linuxSlotDir.endsWith("keychain"));
  });
});
