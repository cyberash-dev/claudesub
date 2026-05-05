import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ListProfiles } from "../src/features/list/application/ListProfiles.js";
import { GetStatus } from "../src/features/status/application/GetStatus.js";
import {
  FakeActiveMarker,
  FakeAuthInspector,
  FakeProfileRepository,
  FakeStatusClaudeJsonReader,
  makeProfile,
} from "./_fakes.js";

describe("CON-003 list --json shape", () => {
  // @covers csm:CON-003
  test("empty store renders { active: null, profiles: [] }", async () => {
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const report = await new ListProfiles(repo, marker).execute();

    const json = JSON.stringify({
      active: report.active,
      profiles: report.rows.map((r) => ({
        name: r.metadata.name,
        email: r.metadata.email,
        orgName: r.metadata.orgName,
        subscriptionType: r.metadata.subscriptionType,
        active: r.isActive,
        lastUsedAt: r.metadata.lastUsedAt,
      })),
    });
    const parsed = JSON.parse(json) as { active: string | null; profiles: unknown[] };
    assert.equal(parsed.active, null);
    assert.deepEqual(parsed.profiles, []);
  });

  // @covers csm:CON-003
  test("populated store renders sorted profiles with single active=true", async () => {
    const repo = new FakeProfileRepository();
    repo.file.profiles = [
      makeProfile({ name: "work", email: "w@e.com", orgName: "WorkCo", subscriptionType: "team" }),
      makeProfile({ name: "alpha" }),
      makeProfile({ name: "personal" }),
    ];
    const marker = new FakeActiveMarker();
    marker.value = "personal";
    const report = await new ListProfiles(repo, marker).execute();

    const profiles = report.rows.map((r) => ({
      name: r.metadata.name,
      email: r.metadata.email,
      orgName: r.metadata.orgName,
      subscriptionType: r.metadata.subscriptionType,
      active: r.isActive,
      lastUsedAt: r.metadata.lastUsedAt,
    }));

    assert.deepEqual(profiles.map((p) => p.name), ["alpha", "personal", "work"]);
    assert.equal(profiles.filter((p) => p.active).length, 1);
    assert.equal(profiles.find((p) => p.active)?.name, "personal");
    for (const p of profiles) {
      assert.equal(typeof p.email, "string");
      assert.equal(typeof p.orgName, "string");
      assert.equal(typeof p.subscriptionType, "string");
      assert.equal(typeof p.active, "boolean");
      assert.equal(typeof p.lastUsedAt, "string");
    }
  });
});

describe("CON-004 status --json shape", () => {
  // @covers csm:CON-004
  test("populated state has typed top-level fields and desync=null when uuids match", async () => {
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "p", oauthAccount: { accountUuid: "u-match", emailAddress: "e@e" } })];
    const marker = new FakeActiveMarker();
    marker.value = "p";
    const claudeJson = new FakeStatusClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "u-match", emailAddress: "e@e" };
    claudeJson.userID = "user-id";
    const auth = new FakeAuthInspector();

    const report = await new GetStatus(repo, marker, claudeJson, auth).execute();

    assert.equal(report.active, "p");
    assert.equal(report.profileKnown, true);
    assert.equal(report.desyncReason, null);
    assert.equal(report.claudeJson?.userID, "user-id");
    assert.equal(report.claudeJson?.accountUuid, "u-match");
    assert.equal(typeof report.authStatus, "object");
  });

  // @covers csm:CON-004
  test("desynced field populated only when accountUuids both present and differ", async () => {
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "p", oauthAccount: { accountUuid: "uuid-A" } })];
    const marker = new FakeActiveMarker();
    marker.value = "p";
    const claudeJson = new FakeStatusClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "uuid-B" };
    claudeJson.userID = "user";
    const auth = new FakeAuthInspector();

    const report = await new GetStatus(repo, marker, claudeJson, auth).execute();

    assert.notEqual(report.desyncReason, null);
  });

  // @covers csm:CON-004
  test("authStatus payload preserves error when claude binary missing (simulated)", async () => {
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const claudeJson = new FakeStatusClaudeJsonReader();
    claudeJson.fileMissing = true;
    const auth = new FakeAuthInspector();
    auth.payload = { error: "cannot exec claude: ENOENT" };

    const report = await new GetStatus(repo, marker, claudeJson, auth).execute();

    assert.equal(report.claudeJson, null);
    assert.equal((report.authStatus as { error?: string }).error, "cannot exec claude: ENOENT");
  });
});
