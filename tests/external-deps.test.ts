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
  test("integration: returns a list (possibly empty) without throwing on the host", async () => {
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

function matchedVerbs(code: string): Set<string> {
  const found = new Set<string>();
  const allKnownVerbs = [...ALLOWED_SECURITY_VERBS, ...FORBIDDEN_SECURITY_VERBS];
  for (const v of allKnownVerbs) {
    if (code.includes(`"${v}"`)) found.add(v);
  }
  return found;
}
