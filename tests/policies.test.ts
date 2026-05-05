import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SaveProfile } from "../src/features/save/application/SaveProfile.js";
import { SwitchProfile } from "../src/features/use/application/SwitchProfile.js";
import { NodeSaveProfileRepository } from "../src/features/save/adapters/outbound/NodeSaveProfileRepository.js";
import { NodeSaveActiveMarker } from "../src/features/save/adapters/outbound/NodeSaveActiveMarker.js";
import { NodeUseClaudeJsonWriter } from "../src/features/use/adapters/outbound/NodeUseClaudeJsonWriter.js";
import { profileKeychainService } from "../src/shared/domain/ServiceNames.js";
import {
  FakeActiveMarker,
  FakeAuthVerifier,
  FakeClock,
  FakeCredentialStore,
  FakeProcessInspector,
  FakeProfileRepository,
  FakeSaveClaudeJsonReader,
  makeProfile,
} from "./_fakes.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(HERE, "..", "src", "cli.js");
const TOKEN = "SECRET_TOKEN_BLOB_DO_NOT_LEAK_a8f3c91d";

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

async function fileContains(path: string, needle: string): Promise<boolean> {
  const buf = await readFile(path);
  return buf.includes(Buffer.from(needle, "utf8"));
}

describe("POL-001 / INV-004 — token blob never written to stdout/stderr/non-keychain files", () => {
  // @covers csm:POL-001
  // @covers csm:INV-004
  test("SaveProfile writes the token only to the credential store, never to repo/marker files", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "csm-pol-"));
    try {
      const credentials = new FakeCredentialStore();
      credentials.liveBlob = TOKEN;
      const repo = new NodeSaveProfileRepository(stateDir, join(stateDir, "profiles.json"));
      const marker = new NodeSaveActiveMarker(stateDir, join(stateDir, "active"));
      const claudeJson = new FakeSaveClaudeJsonReader();
      claudeJson.oauthAccount = { accountUuid: "u", emailAddress: "e@e" };
      claudeJson.userID = "uid";

      await new SaveProfile(credentials, repo, marker, claudeJson, new FakeClock()).execute({
        name: "personal", overwrite: false,
      });

      for (const f of await walk(stateDir)) {
        assert.equal(await fileContains(f, TOKEN), false, `token leaked into ${relative(stateDir, f)}`);
      }
      assert.equal(credentials.blobs.get(profileKeychainService("personal")), TOKEN);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  // @covers csm:POL-001
  // @covers csm:INV-004
  test("SwitchProfile writes the token only to the credential store, never to claude.json or state dir", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "csm-pol-use-"));
    try {
      const claudeJsonPath = join(stateDir, ".claude.json");
      await writeFile(claudeJsonPath, JSON.stringify({ userID: "old", oauthAccount: { accountUuid: "old" } }, null, 2), { mode: 0o600 });

      const credentials = new FakeCredentialStore();
      credentials.liveBlob = "live-blob";
      credentials.blobs.set(profileKeychainService("work"), TOKEN);
      const repo = new FakeProfileRepository();
      repo.file.profiles = [makeProfile({ name: "work", oauthAccount: { accountUuid: "new" }, userID: "new" })];
      const marker = new FakeActiveMarker();
      const writer = new NodeUseClaudeJsonWriter(claudeJsonPath);
      const inspector = new FakeProcessInspector();
      const auth = new FakeAuthVerifier();

      await new SwitchProfile(credentials, repo, marker, writer, inspector, auth, new FakeClock()).execute({
        name: "work", force: false, noVerify: true,
      });

      assert.equal(await fileContains(claudeJsonPath, TOKEN), false, "token leaked into ~/.claude.json");
      assert.equal(credentials.liveBlob, TOKEN);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  // @covers csm:POL-001
  // @covers csm:INV-004
  test("CLI list/status output never contains the live token (smoke)", async () => {
    const home = await mkdtemp(join(tmpdir(), "csm-pol-cli-"));
    try {
      const r = await runCli(["list"], home);
      assert.equal(r.exitCode, 0);
      assert.equal(r.stdout.includes(TOKEN), false);
      assert.equal(r.stderr.includes(TOKEN), false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("POL-002 — state directory + metadata file permissions", () => {
  // @covers csm:POL-002
  test("first save creates ~/.claude-subscription-manager/ with mode 0700 and profiles.json with mode 0600", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "csm-perm-"));
    try {
      // Wipe the freshly-mkdtemp'd dir to force ensureStateDir to create it.
      await rm(stateDir, { recursive: true, force: true });
      const repo = new NodeSaveProfileRepository(stateDir, join(stateDir, "profiles.json"));
      await repo.write({ version: 1, profiles: [makeProfile()] });
      assert.equal((await stat(stateDir)).mode & 0o777, 0o700);
      assert.equal((await stat(join(stateDir, "profiles.json"))).mode & 0o777, 0o600);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  // @covers csm:POL-002
  test("ensureStateDir narrows pre-existing 0755 directory back to 0700", async () => {
    const { mkdir, chmod } = await import("node:fs/promises");
    const stateDir = await mkdtemp(join(tmpdir(), "csm-perm-narrow-"));
    try {
      await rm(stateDir, { recursive: true, force: true });
      await mkdir(stateDir, { recursive: true, mode: 0o755 });
      await chmod(stateDir, 0o755);
      assert.equal((await stat(stateDir)).mode & 0o777, 0o755);

      const repo = new NodeSaveProfileRepository(stateDir, join(stateDir, "profiles.json"));
      await repo.write({ version: 1, profiles: [makeProfile()] });
      assert.equal((await stat(stateDir)).mode & 0o777, 0o700);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  // @covers csm:POL-002
  test("active marker file is mode 0600", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "csm-perm-marker-"));
    try {
      const writer = new NodeSaveActiveMarker(stateDir, join(stateDir, "active"));
      await writer.write("personal");
      assert.equal((await stat(join(stateDir, "active"))).mode & 0o777, 0o600);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], homeOverride: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: homeOverride },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}
