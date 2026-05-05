import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeSaveProfileRepository } from "../src/features/save/adapters/outbound/NodeSaveProfileRepository.js";
import { NodeSaveActiveMarker } from "../src/features/save/adapters/outbound/NodeSaveActiveMarker.js";
import { NodeListProfileRepository } from "../src/features/list/adapters/outbound/NodeListProfileRepository.js";
import { NodeListActiveMarker } from "../src/features/list/adapters/outbound/NodeListActiveMarker.js";
import { NodeUseClaudeJsonWriter } from "../src/features/use/adapters/outbound/NodeUseClaudeJsonWriter.js";
import {
  emptyProfilesFile,
  UnsupportedProfilesFileVersion,
} from "../src/shared/domain/ProfilesFile.js";
import { makeProfile } from "./_fakes.js";

interface TmpEnv {
  stateDir: string;
  profilesPath: string;
  markerPath: string;
  cleanup(): Promise<void>;
}

async function makeTmpEnv(): Promise<TmpEnv> {
  const stateDir = await mkdtemp(join(tmpdir(), "csm-state-"));
  const profilesPath = join(stateDir, "profiles.json");
  const markerPath = join(stateDir, "active");
  return {
    stateDir,
    profilesPath,
    markerPath,
    cleanup: () => rm(stateDir, { recursive: true, force: true }),
  };
}

describe("CON-005 profiles.json schema", () => {
  // @covers csm:CON-005
  test("round-trip via Save→List adapters preserves shape", async () => {
    const env = await makeTmpEnv();
    try {
      const writeRepo = new NodeSaveProfileRepository(env.stateDir, env.profilesPath);
      const file = emptyProfilesFile();
      file.profiles.push(makeProfile({ name: "personal" }));
      file.profiles.push(makeProfile({ name: "work", email: "w@e.com" }));
      await writeRepo.write(file);

      const readRepo = new NodeListProfileRepository(env.profilesPath);
      const back = await readRepo.read();
      assert.equal(back.version, 1);
      assert.deepEqual(back.profiles.map((p) => p.name).sort(), ["personal", "work"]);
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-005
  // @covers csm:INV-003
  test("written file is mode 0600; state directory mode 0700", async () => {
    const env = await makeTmpEnv();
    try {
      const repo = new NodeSaveProfileRepository(env.stateDir, env.profilesPath);
      await repo.write(emptyProfilesFile());
      const fileMode = (await stat(env.profilesPath)).mode & 0o777;
      const dirMode = (await stat(env.stateDir)).mode & 0o777;
      assert.equal(fileMode, 0o600, `got file mode 0o${fileMode.toString(8)}`);
      assert.equal(dirMode, 0o700, `got dir mode 0o${dirMode.toString(8)}`);
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-005
  test("rejects file with version != 1", async () => {
    const env = await makeTmpEnv();
    try {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(env.stateDir, { recursive: true });
      await writeFile(env.profilesPath, JSON.stringify({ version: 2, profiles: [] }), { mode: 0o600 });
      const repo = new NodeListProfileRepository(env.profilesPath);
      await assert.rejects(() => repo.read(), UnsupportedProfilesFileVersion);
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-005
  test("missing file is treated as empty store", async () => {
    const env = await makeTmpEnv();
    try {
      const repo = new NodeListProfileRepository(env.profilesPath);
      const file = await repo.read();
      assert.deepEqual(file, emptyProfilesFile());
    } finally {
      await env.cleanup();
    }
  });
});

describe("CON-006 active marker file format", () => {
  // @covers csm:CON-006
  // @covers csm:INV-003
  test("write→read round-trip; trimmed value matches", async () => {
    const env = await makeTmpEnv();
    try {
      const writer = new NodeSaveActiveMarker(env.stateDir, env.markerPath);
      await writer.write("personal");
      const reader = new NodeListActiveMarker(env.markerPath);
      assert.equal(await reader.read(), "personal");
      const fileMode = (await stat(env.markerPath)).mode & 0o777;
      assert.equal(fileMode, 0o600);
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-006
  test("missing marker reads as null", async () => {
    const env = await makeTmpEnv();
    try {
      const reader = new NodeListActiveMarker(env.markerPath);
      assert.equal(await reader.read(), null);
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-006
  test("empty/whitespace-only marker reads as null", async () => {
    const env = await makeTmpEnv();
    try {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(env.stateDir, { recursive: true });
      await writeFile(env.markerPath, "   \n", { mode: 0o600 });
      const reader = new NodeListActiveMarker(env.markerPath);
      assert.equal(await reader.read(), null);
    } finally {
      await env.cleanup();
    }
  });
});

describe("CON-007 ~/.claude.json patch protocol", () => {
  async function makeClaudeJson(seed: Record<string, unknown>): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const dir = await mkdtemp(join(tmpdir(), "csm-claude-"));
    const path = join(dir, ".claude.json");
    await writeFile(path, JSON.stringify(seed, null, 2), { mode: 0o600 });
    return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
  }

  // @covers csm:CON-007
  test("only oauthAccount and userID change; everything else preserved byte-for-byte", async () => {
    const seed = {
      userID: "old-user",
      oauthAccount: { accountUuid: "old-uuid" },
      preservedTopLevel: "preserved",
      preservedNested: { keepThis: 42, keepArray: [1, 2, 3] },
    };
    const env = await makeClaudeJson(seed);
    try {
      const writer = new NodeUseClaudeJsonWriter(env.path);
      await writer.patch({ accountUuid: "new-uuid", emailAddress: "x@y" }, "new-user");
      const after = JSON.parse(await readFile(env.path, "utf8")) as Record<string, unknown>;
      assert.equal(after.userID, "new-user");
      assert.deepEqual(after.oauthAccount, { accountUuid: "new-uuid", emailAddress: "x@y" });
      assert.equal(after.preservedTopLevel, "preserved");
      assert.deepEqual(after.preservedNested, { keepThis: 42, keepArray: [1, 2, 3] });
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-007
  test("file mode is preserved across the patch", async () => {
    const env = await makeClaudeJson({ userID: "u", oauthAccount: {} });
    try {
      const before = (await stat(env.path)).mode & 0o777;
      const writer = new NodeUseClaudeJsonWriter(env.path);
      await writer.patch({ x: 1 }, "user-2");
      const after = (await stat(env.path)).mode & 0o777;
      assert.equal(after, before);
    } finally {
      await env.cleanup();
    }
  });

  // @covers csm:CON-007
  test("lock file is removed after patch on every exit path", async () => {
    const env = await makeClaudeJson({ userID: "u", oauthAccount: {} });
    try {
      const writer = new NodeUseClaudeJsonWriter(env.path);
      await writer.patch({ accountUuid: "z" }, "user-3");
      const lockPath = `${env.path}.csm.lock`;
      await assert.rejects(stat(lockPath), { code: "ENOENT" });
    } finally {
      await env.cleanup();
    }
  });
});
