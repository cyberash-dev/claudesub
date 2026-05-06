import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ChildProcessUseProcessInspector } from "../src/features/use/adapters/outbound/ChildProcessUseProcessInspector.js";
import { ChildProcessStatusAuthInspector } from "../src/features/status/adapters/outbound/ChildProcessStatusAuthInspector.js";
import { NodeStatusClaudeJsonReader } from "../src/features/status/adapters/outbound/NodeStatusClaudeJsonReader.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(HERE, "..", "..", "src");

const ALLOWED_SECURITY_VERBS = new Set([
  "find-generic-password",
  "add-generic-password",
  "delete-generic-password",
]);
const FORBIDDEN_SECURITY_VERBS = [
  "set-generic-password",
  "create-keychain",
  "delete-keychain",
  "list-keychains",
  "default-keychain",
  "lock-keychain",
  "unlock-keychain",
  "import",
  "export",
  "set-internet-password",
];

const SECURITY_ADAPTER_PATHS = [
  "features/save/adapters/outbound/ChildProcessSaveCredentialStore.ts",
  "features/use/adapters/outbound/ChildProcessUseCredentialStore.ts",
  "features/rm/adapters/outbound/ChildProcessRmCredentialStore.ts",
  "features/rename/adapters/outbound/ChildProcessRenameCredentialStore.ts",
];

describe("EXT-001 macOS Keychain via /usr/bin/security", () => {
  // @covers csm:EXT-001
  test("every credential adapter spawns only /usr/bin/security with the allowed verbs", async () => {
    for (const rel of SECURITY_ADAPTER_PATHS) {
      const code = await readFile(join(SRC_ROOT, rel), "utf8");
      assert.match(code, /\/usr\/bin\/security/, `${rel} must spawn /usr/bin/security`);

      const usedVerbs = matchedVerbs(code);
      for (const v of usedVerbs) {
        assert.ok(ALLOWED_SECURITY_VERBS.has(v), `${rel} uses disallowed verb "${v}"`);
      }
      for (const forbidden of FORBIDDEN_SECURITY_VERBS) {
        assert.equal(code.includes(`"${forbidden}"`), false, `${rel} mentions forbidden verb "${forbidden}"`);
      }
    }
  });

  // @covers csm:EXT-001
  test("exit code 44 is treated as a typed not-found result, not an error", async () => {
    for (const rel of SECURITY_ADAPTER_PATHS) {
      const code = await readFile(join(SRC_ROOT, rel), "utf8");
      assert.match(code, /=== 44/, `${rel} must branch on exit 44`);
    }
  });
});

describe("EXT-002 macOS process inspection via /usr/bin/pgrep", () => {
  // @covers csm:EXT-002
  test("inspector spawns /usr/bin/pgrep with the documented pattern only", async () => {
    const code = await readFile(
      join(SRC_ROOT, "features/use/adapters/outbound/ChildProcessUseProcessInspector.ts"),
      "utf8",
    );
    assert.match(code, /\/usr\/bin\/pgrep/);
    assert.match(code, /-lf/);
    assert.ok(
      code.includes('"(^|/)(claude|Claude\\\\.app)"'),
      "pgrep pattern argv must be the documented one verbatim",
    );
  });

  // @covers csm:EXT-002
  test("integration: returns a list (possibly empty) without throwing on the host", async (t) => {
    if (process.platform !== "darwin") {
      t.skip("EXT-002 live integration is macOS-only");
      return;
    }
    const inspector = new ChildProcessUseProcessInspector();
    const list = await inspector.findRunning();
    assert.ok(Array.isArray(list));
    for (const r of list) {
      assert.equal(typeof r.pid, "number");
      assert.equal(typeof r.command, "string");
    }
  });
});

describe("EXT-003 Anthropic Claude Code CLI", () => {
  // @covers csm:EXT-003
  test("verifier spawns `claude` with `auth status --json` only", async () => {
    const code = await readFile(
      join(SRC_ROOT, "features/use/adapters/outbound/ChildProcessUseAuthVerifier.ts"),
      "utf8",
    );
    assert.match(code, /spawn\("claude",\s*\["auth",\s*"status",\s*"--json"\]/);
  });

  // @covers csm:EXT-003
  test("status inspector spawns `claude` with `auth status --json` only", async () => {
    const code = await readFile(
      join(SRC_ROOT, "features/status/adapters/outbound/ChildProcessStatusAuthInspector.ts"),
      "utf8",
    );
    assert.match(code, /spawn\("claude",\s*\["auth",\s*"status",\s*"--json"\]/);
  });

  // @covers csm:EXT-003
  test("integration: live `claude auth status --json` either returns a parseable payload or a typed error field", async () => {
    const inspector = new ChildProcessStatusAuthInspector();
    const result = await inspector.fetch();
    assert.equal(typeof result, "object");
    if ("error" in result && result.error) {
      assert.equal(typeof result.error, "string");
    } else {
      assert.equal(typeof result.loggedIn, "boolean");
    }
  });

  // @covers csm:EXT-003
  test("logout adapter spawns `claude` with `auth logout` only (source check)", async () => {
    const code = await readFile(
      join(SRC_ROOT, "features/add/adapters/outbound/ChildProcessAddLogout.ts"),
      "utf8",
    );
    assert.match(code, /spawn\("claude",\s*\["auth",\s*"logout"\]/);
  });
});

describe("EXT-004 Claude Code persistent state file ~/.claude.json", () => {
  // @covers csm:EXT-004
  test("missing file returns null (status reader)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csm-ext4-missing-"));
    try {
      const reader = new NodeStatusClaudeJsonReader(join(dir, ".claude.json"));
      assert.equal(await reader.read(), null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // @covers csm:EXT-004
  test("malformed JSON returns null (status reader)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csm-ext4-malformed-"));
    try {
      const path = join(dir, ".claude.json");
      await writeFile(path, "{this is not json", { mode: 0o600 });
      const reader = new NodeStatusClaudeJsonReader(path);
      assert.equal(await reader.read(), null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // @covers csm:EXT-004
  test("only `userID` and `oauthAccount` are read; other fields ignored", async () => {
    const dir = await mkdtemp(join(tmpdir(), "csm-ext4-shape-"));
    try {
      const path = join(dir, ".claude.json");
      await writeFile(path, JSON.stringify({
        userID: "user-1",
        oauthAccount: { accountUuid: "uuid-1" },
        unrelated: "field",
        nested: { keep: 1 },
      }), { mode: 0o600 });
      const reader = new NodeStatusClaudeJsonReader(path);
      const view = await reader.read();
      assert.equal(view?.userID, "user-1");
      assert.equal((view?.oauthAccount as { accountUuid: string } | undefined)?.accountUuid, "uuid-1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("EXT-006 Linux file-based credentials store", () => {
  const LINUX_FILE_ADAPTERS = [
    "features/save/adapters/outbound/LinuxFileSaveCredentialStore.ts",
    "features/use/adapters/outbound/LinuxFileUseCredentialStore.ts",
    "features/rm/adapters/outbound/LinuxFileRmCredentialStore.ts",
    "features/rename/adapters/outbound/LinuxFileRenameCredentialStore.ts",
    "features/export/adapters/outbound/LinuxFileExportCredentialStore.ts",
    "features/import/adapters/outbound/LinuxFileImportCredentialStore.ts",
  ];

  // @covers csm:EXT-006
  // @covers csm:POL-005
  test("Linux file adapters never spawn child processes", async () => {
    for (const rel of LINUX_FILE_ADAPTERS) {
      const code = await readFile(join(SRC_ROOT, rel), "utf8");
      assert.equal(code.includes("child_process"), false, `${rel} must not import child_process`);
      assert.equal(/\bspawn\(/.test(code), false, `${rel} must not call spawn()`);
      assert.equal(code.includes("execSync"), false, `${rel} must not use execSync`);
      assert.equal(code.includes("execFile"), false, `${rel} must not use execFile`);
    }
  });

  // @covers csm:EXT-006
  test("Linux file adapters use only fs/promises and node:path / node:crypto", async () => {
    for (const rel of LINUX_FILE_ADAPTERS) {
      const code = await readFile(join(SRC_ROOT, rel), "utf8");
      const allowedNodeImports = ["node:fs/promises", "node:crypto", "node:path"];
      const importLines = code.match(/^import .*?from "(node:[^"]+)"/gm) ?? [];
      for (const line of importLines) {
        const match = line.match(/from "(node:[^"]+)"/);
        if (!match) continue;
        assert.ok(
          allowedNodeImports.includes(match[1]!),
          `${rel} imports unexpected node: module "${match[1]}"`,
        );
      }
    }
  });

  // @covers csm:INV-006
  test("Linux save/use/rename/import adapters write profile slots with mode 0600", async () => {
    const writers = [
      "features/save/adapters/outbound/LinuxFileSaveCredentialStore.ts",
      "features/use/adapters/outbound/LinuxFileUseCredentialStore.ts",
      "features/rename/adapters/outbound/LinuxFileRenameCredentialStore.ts",
      "features/import/adapters/outbound/LinuxFileImportCredentialStore.ts",
    ];
    for (const rel of writers) {
      const code = await readFile(join(SRC_ROOT, rel), "utf8");
      assert.match(code, /mode:\s*0o600/, `${rel} must write slot files with mode 0o600`);
      assert.match(code, /mode:\s*0o700/, `${rel} must create the slot dir with mode 0o700`);
    }
  });
});

describe("EXT-007 Windows Credential Manager via PowerShell + advapi32", () => {
  const WINDOWS_CM_ADAPTERS = [
    "features/save/adapters/outbound/WindowsCmSaveCredentialStore.ts",
    "features/use/adapters/outbound/WindowsCmUseCredentialStore.ts",
    "features/rm/adapters/outbound/WindowsCmRmCredentialStore.ts",
    "features/rename/adapters/outbound/WindowsCmRenameCredentialStore.ts",
    "features/export/adapters/outbound/WindowsCmExportCredentialStore.ts",
    "features/import/adapters/outbound/WindowsCmImportCredentialStore.ts",
  ];

  // @covers csm:EXT-007
  test("WindowsCm* adapters never call spawn directly — they delegate to the shared helper", async () => {
    for (const rel of WINDOWS_CM_ADAPTERS) {
      const code = await readFile(join(SRC_ROOT, rel), "utf8");
      assert.equal(code.includes("child_process"), false, `${rel} must not import child_process directly`);
      assert.equal(/\bspawn\(/.test(code), false, `${rel} must not call spawn()`);
      assert.match(code, /WincredPowerShell/, `${rel} must import the shared WincredPowerShell helper`);
    }
  });

  // @covers csm:EXT-007
  test("WincredPowerShell helper spawns powershell.exe with the documented flags only", async () => {
    const code = await readFile(join(SRC_ROOT, "shared/domain/WincredPowerShell.ts"), "utf8");
    assert.match(code, /spawn\(\s*"powershell\.exe"/);
    assert.match(code, /-NoProfile/);
    assert.match(code, /-NonInteractive/);
    assert.equal(code.includes("Invoke-Expression"), false, "must not use Invoke-Expression");
    assert.equal(code.includes("iex "), false, "must not use the iex alias");
    assert.equal(code.includes("Get-StoredCredential"), false, "must not depend on the CredentialManager PS module");
    assert.equal(code.includes("New-StoredCredential"), false, "must not depend on the CredentialManager PS module");
  });

  // @covers csm:EXT-007
  test("WincredPowerShell helper rejects MSYS / Git Bash environments", async () => {
    const code = await readFile(join(SRC_ROOT, "shared/domain/WincredPowerShell.ts"), "utf8");
    assert.match(code, /MSYSTEM/);
    assert.match(code, /WincredUnavailable/);
  });

  // @covers csm:INV-007
  // @covers csm:POL-006
  test("WincredPowerShell write path delivers the blob via stdin, never via argv", async () => {
    const code = await readFile(join(SRC_ROOT, "shared/domain/WincredPowerShell.ts"), "utf8");
    assert.match(code, /\[Console\]::In\.ReadToEnd/, "blob must be read from PowerShell stdin");
    assert.match(code, /child\.stdin\.end\(stdin\)/, "Node side must write the blob to stdin and close");
  });
});

describe("EXT-008 Linux process inspection via /proc", () => {
  // @covers csm:EXT-008
  test("ProcFsUseProcessInspector reads /proc only and never spawns processes", async () => {
    const code = await readFile(
      join(SRC_ROOT, "features/use/adapters/outbound/ProcFsUseProcessInspector.ts"),
      "utf8",
    );
    assert.equal(code.includes("child_process"), false, "must not import child_process");
    assert.equal(/\bspawn\(/.test(code), false, "must not call spawn()");
    assert.match(code, /\/proc/, "must reference /proc");
    assert.match(code, /readdir/, "must use readdir for /proc enumeration");
    assert.match(code, /cmdline/, "must read per-pid cmdline file");
  });

  // @covers csm:EXT-008
  test("integration: returns a list (possibly empty) without throwing on a real procfs", async (t) => {
    if (process.platform !== "linux") {
      t.skip("EXT-008 live integration is Linux-only");
      return;
    }
    const { ProcFsUseProcessInspector } = await import(
      "../src/features/use/adapters/outbound/ProcFsUseProcessInspector.js"
    );
    const inspector = new ProcFsUseProcessInspector();
    const list = await inspector.findRunning();
    assert.ok(Array.isArray(list));
    for (const r of list) {
      assert.equal(typeof r.pid, "number");
      assert.equal(typeof r.command, "string");
    }
  });
});

describe("EXT-009 Windows process inspection via tasklist", () => {
  // @covers csm:EXT-009
  test("WindowsTasklistUseProcessInspector spawns tasklist.exe with the documented argv only", async () => {
    const code = await readFile(
      join(SRC_ROOT, "features/use/adapters/outbound/WindowsTasklistUseProcessInspector.ts"),
      "utf8",
    );
    assert.match(code, /spawn\("tasklist\.exe"/);
    assert.match(code, /"\/FO",\s*"CSV"/);
    assert.match(code, /"\/NH"/);
    assert.match(code, /"\/V"/);
  });

  // @covers csm:EXT-009
  test("integration: tasklist returns a parseable list", async (t) => {
    if (process.platform !== "win32") {
      t.skip("EXT-009 live integration is Windows-only");
      return;
    }
    const { WindowsTasklistUseProcessInspector } = await import(
      "../src/features/use/adapters/outbound/WindowsTasklistUseProcessInspector.js"
    );
    const inspector = new WindowsTasklistUseProcessInspector();
    const list = await inspector.findRunning();
    assert.ok(Array.isArray(list));
  });
});

describe("EXT-006 / EXT-007 live credential-store round-trip", () => {
  // @covers csm:EXT-006
  test("integration: Linux file save+read round-trip preserves bytes", async (t) => {
    if (process.platform !== "linux") {
      t.skip("EXT-006 live integration is Linux-only");
      return;
    }
    const { LinuxFileSaveCredentialStore } = await import(
      "../src/features/save/adapters/outbound/LinuxFileSaveCredentialStore.js"
    );
    const { LinuxFileRenameCredentialStore } = await import(
      "../src/features/rename/adapters/outbound/LinuxFileRenameCredentialStore.js"
    );
    const dir = await mkdtemp(join(tmpdir(), "csm-ext6-rt-"));
    try {
      const liveCredsPath = join(dir, ".credentials.json");
      const slotDir = join(dir, "slots");
      const blob = JSON.stringify({ claudeAiOauth: { accessToken: "sentinel-abc" } });
      await writeFile(liveCredsPath, blob, { mode: 0o600 });
      const save = new LinuxFileSaveCredentialStore(liveCredsPath, slotDir);
      const live = await save.readLive();
      assert.equal(live, blob);
      const profileService = "Claude Code-credentials.profile.test";
      await save.writeProfile(profileService, blob);
      const reader = new LinuxFileRenameCredentialStore(slotDir);
      const slotBack = await reader.read(profileService);
      assert.equal(slotBack, blob);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // @covers csm:EXT-007
  test("integration: Windows Credential Manager round-trip on a throwaway target", async (t) => {
    if (process.platform !== "win32") {
      t.skip("EXT-007 live integration is Windows-only");
      return;
    }
    const { wincredWrite, wincredRead, wincredDelete } = await import(
      "../src/shared/domain/WincredPowerShell.js"
    );
    const target = `csm-self-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const blob = JSON.stringify({ claudeAiOauth: { sentinel: "csm-cm-roundtrip" } });
    try {
      await wincredWrite(target, blob, "csm-test-user");
      const back = await wincredRead(target);
      assert.equal(back, blob);
    } finally {
      await wincredDelete(target).catch(() => {});
    }
  });
});

function matchedVerbs(code: string): Set<string> {
  const found = new Set<string>();
  const allKnownVerbs = [...ALLOWED_SECURITY_VERBS, ...FORBIDDEN_SECURITY_VERBS];
  for (const v of allKnownVerbs) {
    if (code.includes(`"${v}"`)) found.add(v);
  }
  return found;
}
