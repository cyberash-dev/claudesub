import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ListProfiles } from "../src/features/list/application/ListProfiles.js";
import { GetStatus } from "../src/features/status/application/GetStatus.js";
import { SaveProfile } from "../src/features/save/application/SaveProfile.js";
import { SwitchProfile } from "../src/features/use/application/SwitchProfile.js";
import { RemoveProfile } from "../src/features/rm/application/RemoveProfile.js";
import { RenameProfile } from "../src/features/rename/application/RenameProfile.js";
import { AddProfile } from "../src/features/add/application/AddProfile.js";
import {
  AuthVerificationFailed,
  ClaudeIsRunning,
  UnknownProfile as UnknownProfileForUse,
} from "../src/features/use/domain/SwitchOutcome.js";
import { NotLoggedIn, ProfileAlreadyExists } from "../src/features/save/domain/SaveOutcome.js";
import { RmAborted, UnknownProfile as UnknownProfileForRm } from "../src/features/rm/domain/RmOutcome.js";
import {
  RenameSourceMissing,
  RenameTargetExists,
} from "../src/features/rename/domain/RenameOutcome.js";
import { AddDeclined, LogoutFailed } from "../src/features/add/domain/AddOutcome.js";
import { profileKeychainService } from "../src/shared/domain/ServiceNames.js";

import {
  FakeActiveMarker,
  FakeAuthInspector,
  FakeAuthVerifier,
  FakeSaveClaudeJsonReader,
  FakeStatusClaudeJsonReader,
  FakeClaudeJsonWriter,
  FakeClock,
  FakeConfirmer,
  FakeCredentialStore,
  FakeLogout,
  FakeProcessInspector,
  FakeProfileRepository,
  FakePrompt,
  FakeSnapshotter,
  makeProfile,
} from "./_fakes.js";

describe("ListProfiles", () => {
  // @covers csm:BEH-001
  test("returns empty when store has no profiles", async () => {
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const result = await new ListProfiles(repo, marker).execute();
    assert.deepEqual(result, { active: null, rows: [] });
  });

  // @covers csm:BEH-001
  test("sorts profiles by name and marks active", async () => {
    const repo = new FakeProfileRepository();
    repo.file.profiles = [
      makeProfile({ name: "work" }),
      makeProfile({ name: "alpha" }),
      makeProfile({ name: "personal" }),
    ];
    const marker = new FakeActiveMarker();
    marker.value = "personal";

    const result = await new ListProfiles(repo, marker).execute();

    assert.deepEqual(result.rows.map((r) => r.metadata.name), ["alpha", "personal", "work"]);
    assert.deepEqual(result.rows.map((r) => r.isActive), [false, true, false]);
    assert.equal(result.active, "personal");
  });
});

describe("GetStatus", () => {
  // @covers csm:BEH-002
  test("reports loggedIn email + plan when active matches claude.json", async () => {
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" })];
    const marker = new FakeActiveMarker();
    marker.value = "personal";
    const claudeJson = new FakeStatusClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "uuid-test", emailAddress: "test@example.com" };
    claudeJson.userID = "user-test";
    const auth = new FakeAuthInspector();

    const status = await new GetStatus(repo, marker, claudeJson, auth).execute();

    assert.equal(status.active, "personal");
    assert.equal(status.profileKnown, true);
    assert.equal(status.desyncReason, null);
    assert.equal(status.claudeJson?.accountUuid, "uuid-test");
  });

  // @covers csm:BEH-002
  test("reports desync when accountUuid differs", async () => {
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal", oauthAccount: { accountUuid: "uuid-A" } })];
    const marker = new FakeActiveMarker();
    marker.value = "personal";
    const claudeJson = new FakeStatusClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "uuid-B" };
    claudeJson.userID = "user-test";
    const auth = new FakeAuthInspector();

    const status = await new GetStatus(repo, marker, claudeJson, auth).execute();

    assert.notEqual(status.desyncReason, null);
    assert.match(status.desyncReason ?? "", /uuid-A.+uuid-B|uuid-B.+uuid-A/);
  });
});

describe("SaveProfile", () => {
  // @covers csm:BEH-003
  test("snapshots live keychain + claude.json metadata into a new profile", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "blob-token-bytes";
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const claudeJson = new FakeSaveClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "uuid-1", emailAddress: "u@e.com", organizationName: "Org", billingType: "max" };
    claudeJson.userID = "user-1";
    const clock = new FakeClock();

    const outcome = await new SaveProfile(credentials, repo, marker, claudeJson, clock).execute({
      name: "personal",
      overwrite: false,
    });

    assert.equal(outcome.profile.name, "personal");
    assert.equal(outcome.profile.email, "u@e.com");
    assert.equal(outcome.profile.subscriptionType, "max");
    assert.equal(credentials.blobs.get(profileKeychainService("personal")), "blob-token-bytes");
    assert.equal(marker.value, "personal");
    assert.equal(repo.file.profiles.length, 1);
  });

  // @covers csm:BEH-003
  test("rejects duplicate without --overwrite", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "x";
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" })];
    const marker = new FakeActiveMarker();
    const claudeJson = new FakeSaveClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "uuid-1" };
    claudeJson.userID = "user-1";
    const clock = new FakeClock();

    await assert.rejects(
      () => new SaveProfile(credentials, repo, marker, claudeJson, clock).execute({ name: "personal", overwrite: false }),
      ProfileAlreadyExists,
    );
  });

  // @covers csm:BEH-003
  test("rejects when not logged in", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "x";
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const claudeJson = new FakeSaveClaudeJsonReader();
    const clock = new FakeClock();

    await assert.rejects(
      () => new SaveProfile(credentials, repo, marker, claudeJson, clock).execute({ name: "personal", overwrite: false }),
      NotLoggedIn,
    );
  });

  // @covers csm:INV-001
  test("upsert replaces existing row instead of duplicating it", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "blob-2";
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal", email: "old@example.com" })];
    const marker = new FakeActiveMarker();
    const claudeJson = new FakeSaveClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "uuid-2", emailAddress: "new@example.com" };
    claudeJson.userID = "user-2";
    const clock = new FakeClock();

    await new SaveProfile(credentials, repo, marker, claudeJson, clock).execute({ name: "personal", overwrite: true });

    const matches = repo.file.profiles.filter((p) => p.name === "personal");
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.email, "new@example.com");
  });
});

describe("SwitchProfile", () => {
  // @covers csm:BEH-004
  // @covers csm:INV-005
  test("swaps live keychain + patches claude.json + updates marker + verifies", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "live-blob-A";
    credentials.blobs.set(profileKeychainService("work"), "saved-blob-B");
    const repo = new FakeProfileRepository();
    const target = makeProfile({
      name: "work",
      oauthAccount: { accountUuid: "uuid-B", emailAddress: "b@e.com" },
      userID: "user-B",
    });
    repo.file.profiles = [makeProfile({ name: "personal", oauthAccount: { accountUuid: "uuid-A" }, userID: "user-A" }), target];
    const marker = new FakeActiveMarker();
    marker.value = "personal";
    credentials.blobs.set(profileKeychainService("personal"), "stale-personal-blob");
    const claudeJsonWriter = new FakeClaudeJsonWriter();
    const inspector = new FakeProcessInspector();
    const auth = new FakeAuthVerifier();
    const clock = new FakeClock();

    const outcome = await new SwitchProfile(
      credentials, repo, marker, claudeJsonWriter, inspector, auth, clock,
    ).execute({ name: "work", force: false, noVerify: false });

    assert.equal(credentials.liveBlob, "saved-blob-B");
    assert.equal(claudeJsonWriter.last()?.userID, "user-B");
    assert.equal((claudeJsonWriter.last()?.oauthAccount.accountUuid as string | undefined), "uuid-B");
    assert.equal(marker.value, "work");
    assert.equal(outcome.target.name, "work");
    assert.equal(auth.calls, 1);
  });

  // @covers csm:BEH-004
  test("auto-snapshots active profile before swap (captures rotated tokens)", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "rotated-personal-blob";
    credentials.blobs.set(profileKeychainService("personal"), "stale-personal-blob");
    credentials.blobs.set(profileKeychainService("work"), "saved-work-blob");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" }), makeProfile({ name: "work" })];
    const marker = new FakeActiveMarker();
    marker.value = "personal";

    await new SwitchProfile(
      credentials, repo, marker, new FakeClaudeJsonWriter(), new FakeProcessInspector(), new FakeAuthVerifier(), new FakeClock(),
    ).execute({ name: "work", force: false, noVerify: true });

    assert.equal(credentials.blobs.get(profileKeychainService("personal")), "rotated-personal-blob");
  });

  // @covers csm:BEH-004
  // @covers csm:POL-003
  test("refuses when claude is running and --force is absent", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "blob";
    credentials.blobs.set(profileKeychainService("work"), "blob");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "work" })];
    const marker = new FakeActiveMarker();
    const inspector = new FakeProcessInspector();
    inspector.running = [{ pid: 4321, command: "/Applications/Claude.app/Contents/MacOS/Claude" }];

    await assert.rejects(
      () => new SwitchProfile(
        credentials, repo, marker, new FakeClaudeJsonWriter(), inspector, new FakeAuthVerifier(), new FakeClock(),
      ).execute({ name: "work", force: false, noVerify: true }),
      ClaudeIsRunning,
    );
    assert.notEqual(credentials.liveBlob, "saved-work-blob"); // no swap happened
  });

  // @covers csm:BEH-004
  test("--force overrides running-claude check", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "live";
    credentials.blobs.set(profileKeychainService("work"), "saved-work");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "work" })];
    const marker = new FakeActiveMarker();
    const inspector = new FakeProcessInspector();
    inspector.running = [{ pid: 1, command: "claude" }];

    await new SwitchProfile(
      credentials, repo, marker, new FakeClaudeJsonWriter(), inspector, new FakeAuthVerifier(), new FakeClock(),
    ).execute({ name: "work", force: true, noVerify: true });

    assert.equal(credentials.liveBlob, "saved-work");
  });

  // @covers csm:BEH-004
  test("rejects unknown profile", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "x";
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new SwitchProfile(
        credentials, repo, marker, new FakeClaudeJsonWriter(), new FakeProcessInspector(), new FakeAuthVerifier(), new FakeClock(),
      ).execute({ name: "ghost", force: false, noVerify: true }),
      UnknownProfileForUse,
    );
  });

  // @covers csm:BEH-004
  test("fails when post-call auth verification reports loggedIn=false", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "live";
    credentials.blobs.set(profileKeychainService("work"), "saved");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "work" })];
    const marker = new FakeActiveMarker();
    const auth = new FakeAuthVerifier();
    auth.result = { ok: false, summary: "loggedIn=false" };

    await assert.rejects(
      () => new SwitchProfile(
        credentials, repo, marker, new FakeClaudeJsonWriter(), new FakeProcessInspector(), auth, new FakeClock(),
      ).execute({ name: "work", force: false, noVerify: false }),
      AuthVerificationFailed,
    );
  });
});

describe("RemoveProfile", () => {
  // @covers csm:BEH-005
  test("deletes keychain slot + metadata; clears active marker if it pointed to the removed profile", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("personal"), "blob");
    credentials.liveBlob = "live-untouched";
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" })];
    const marker = new FakeActiveMarker();
    marker.value = "personal";
    const confirmer = new FakeConfirmer();

    const outcome = await new RemoveProfile(credentials, repo, marker, confirmer).execute({
      name: "personal",
      skipConfirmation: false,
    });

    assert.equal(repo.file.profiles.length, 0);
    assert.equal(credentials.blobs.has(profileKeychainService("personal")), false);
    assert.equal(marker.value, null);
    assert.equal(outcome.liveActiveCleared, true);
    assert.equal(credentials.liveBlob, "live-untouched");
  });

  // @covers csm:BEH-005
  test("does NOT touch active marker when removing an inactive profile", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("work"), "blob");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" }), makeProfile({ name: "work" })];
    const marker = new FakeActiveMarker();
    marker.value = "personal";
    const confirmer = new FakeConfirmer();

    const outcome = await new RemoveProfile(credentials, repo, marker, confirmer).execute({
      name: "work",
      skipConfirmation: true,
    });

    assert.equal(marker.value, "personal");
    assert.equal(outcome.liveActiveCleared, false);
  });

  // @covers csm:BEH-005
  test("rejects unknown profile", async () => {
    const credentials = new FakeCredentialStore();
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const confirmer = new FakeConfirmer();

    await assert.rejects(
      () => new RemoveProfile(credentials, repo, marker, confirmer).execute({ name: "ghost", skipConfirmation: true }),
      UnknownProfileForRm,
    );
  });

  // @covers csm:BEH-005
  test("aborts when user types a non-matching confirmation", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("personal"), "blob");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" })];
    const marker = new FakeActiveMarker();
    const confirmer = new FakeConfirmer();
    confirmer.shouldConfirm = false;

    await assert.rejects(
      () => new RemoveProfile(credentials, repo, marker, confirmer).execute({ name: "personal", skipConfirmation: false }),
      RmAborted,
    );
    assert.equal(repo.file.profiles.length, 1);
    assert.equal(credentials.blobs.has(profileKeychainService("personal")), true);
  });
});

describe("RenameProfile", () => {
  // @covers csm:BEH-006
  test("moves keychain slot + updates metadata + updates active marker", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("personal"), "blob-X");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" })];
    const marker = new FakeActiveMarker();
    marker.value = "personal";

    const outcome = await new RenameProfile(credentials, repo, marker).execute({ oldName: "personal", newName: "home" });

    assert.equal(outcome.activeMarkerUpdated, true);
    assert.equal(marker.value, "home");
    assert.equal(repo.file.profiles[0]?.name, "home");
    assert.equal(credentials.blobs.get(profileKeychainService("home")), "blob-X");
    assert.equal(credentials.blobs.has(profileKeychainService("personal")), false);
  });

  // @covers csm:BEH-006
  test("rejects when source profile is missing", async () => {
    const credentials = new FakeCredentialStore();
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new RenameProfile(credentials, repo, marker).execute({ oldName: "ghost", newName: "new" }),
      RenameSourceMissing,
    );
  });

  // @covers csm:BEH-006
  test("rejects when target name already exists", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("personal"), "blob");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "personal" }), makeProfile({ name: "work" })];
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new RenameProfile(credentials, repo, marker).execute({ oldName: "personal", newName: "work" }),
      RenameTargetExists,
    );
  });
});

describe("AddProfile", () => {
  // @covers csm:BEH-007
  test("orchestrates plan → confirm → logout → wait → snapshot", async () => {
    const logout = new FakeLogout();
    const prompt = new FakePrompt();
    const snapshotter = new FakeSnapshotter();

    await new AddProfile(logout, prompt, snapshotter).execute({ name: "work" });

    assert.deepEqual(prompt.planPrints, ["work"]);
    assert.equal(logout.calls, 1);
    assert.equal(prompt.enterCalls, 1);
    assert.deepEqual(snapshotter.names, ["work"]);
  });

  // @covers csm:BEH-007
  test("aborts before logout when user declines the first prompt", async () => {
    const logout = new FakeLogout();
    const prompt = new FakePrompt();
    prompt.yesNoAnswer = false;
    const snapshotter = new FakeSnapshotter();

    await assert.rejects(
      () => new AddProfile(logout, prompt, snapshotter).execute({ name: "work" }),
      AddDeclined,
    );
    assert.equal(logout.calls, 0);
    assert.deepEqual(snapshotter.names, []);
  });

  // @covers csm:BEH-007
  test("aborts when claude auth logout exits non-zero", async () => {
    const logout = new FakeLogout();
    logout.exitCode = 1;
    const prompt = new FakePrompt();
    const snapshotter = new FakeSnapshotter();

    await assert.rejects(
      () => new AddProfile(logout, prompt, snapshotter).execute({ name: "work" }),
      LogoutFailed,
    );
    assert.equal(snapshotter.names.length, 0);
  });
});

describe("INV-002 active marker validity (post-transition)", () => {
  // @covers csm:INV-002
  test("after save, marker names a profile that exists in profiles.json", async () => {
    const credentials = new FakeCredentialStore();
    credentials.liveBlob = "blob";
    const repo = new FakeProfileRepository();
    const marker = new FakeActiveMarker();
    const claudeJson = new FakeSaveClaudeJsonReader();
    claudeJson.oauthAccount = { accountUuid: "u" };
    claudeJson.userID = "id";
    await new SaveProfile(credentials, repo, marker, claudeJson, new FakeClock()).execute({ name: "p", overwrite: false });

    assert.notEqual(marker.value, null);
    assert.ok(repo.file.profiles.some((p) => p.name === marker.value));
  });

  // @covers csm:INV-002
  test("after rm of active profile, marker is cleared", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("p"), "x");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "p" })];
    const marker = new FakeActiveMarker();
    marker.value = "p";

    await new RemoveProfile(credentials, repo, marker, new FakeConfirmer()).execute({ name: "p", skipConfirmation: true });

    assert.equal(marker.value, null);
  });
});
