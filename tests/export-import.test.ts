import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ExportProfiles } from "../src/features/export/application/ExportProfiles.js";
import {
  MissingProfileBlob,
  NoProfilesToExport,
  PassphraseMismatch,
} from "../src/features/export/domain/ExportOutcome.js";
import { ImportProfiles } from "../src/features/import/application/ImportProfiles.js";
import {
  AllSkippedActive,
  BadPassphrase,
  MalformedBundle,
  UnsupportedBundleVersion,
} from "../src/features/import/domain/ImportOutcome.js";
import { InvalidProfileName } from "../src/features/import/application/ImportProfiles.js";
import type { ProfileBundle } from "../src/shared/domain/ProfileBundle.js";
import { profileKeychainService } from "../src/shared/domain/ServiceNames.js";

import {
  FakeActiveMarker,
  FakeClock,
  FakeCredentialStore,
  FakeExportFileWriter,
  FakeExportPassphrasePrompt,
  FakeImportFileReader,
  FakeImportPassphrasePrompt,
  FakeProfileRepository,
  IdentityCipher,
  makeProfile,
} from "./_fakes.js";

const PASSPHRASE = "secret";

describe("ExportProfiles", () => {
  // @covers csm:BEH-009
  test("encrypts every profile + metadata into a single file (round-trip identity)", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha");
    credentials.blobs.set(profileKeychainService("personal"), "blob-personal");

    const repo = new FakeProfileRepository();
    repo.file.profiles = [
      makeProfile({ name: "personal" }),
      makeProfile({ name: "alpha" }),
    ];

    const prompt = new FakeExportPassphrasePrompt();
    prompt.passphrase = PASSPHRASE;
    const writer = new FakeExportFileWriter();
    const cipher = new IdentityCipher();
    const clock = new FakeClock();

    const outcome = await new ExportProfiles(repo, credentials, prompt, writer, cipher, clock).execute({
      file: "/tmp/csm.bundle",
    });

    assert.equal(outcome.profileCount, 2);
    assert.equal(outcome.filePath, "/tmp/csm.bundle");
    assert.equal(prompt.promptCalls, 1);
    assert.equal(cipher.capturedPassphrase, PASSPHRASE);
    assert.equal(writer.writes.length, 1);

    const ciphertext = writer.last()!.bytes;
    const decrypted = await cipher.decrypt(PASSPHRASE, ciphertext);
    const bundle = JSON.parse(Buffer.from(decrypted).toString("utf8")) as ProfileBundle;

    assert.equal(bundle.version, 1);
    assert.equal(bundle.exportedAt, outcome.exportedAt);
    assert.deepEqual(bundle.profiles.map((p) => p.name), ["personal", "alpha"]);
    assert.equal(
      Buffer.from(bundle.keychainBlobs["alpha"]!, "base64").toString("utf8"),
      "blob-alpha",
    );
    assert.equal(
      Buffer.from(bundle.keychainBlobs["personal"]!, "base64").toString("utf8"),
      "blob-personal",
    );
  });

  // @covers csm:BEH-009
  test("refuses to export an empty store and writes no file", async () => {
    const credentials = new FakeCredentialStore();
    const repo = new FakeProfileRepository();
    const prompt = new FakeExportPassphrasePrompt();
    const writer = new FakeExportFileWriter();
    const cipher = new IdentityCipher();
    const clock = new FakeClock();

    await assert.rejects(
      () => new ExportProfiles(repo, credentials, prompt, writer, cipher, clock).execute({
        file: "/tmp/csm.bundle",
      }),
      NoProfilesToExport,
    );
    assert.equal(writer.writes.length, 0);
    assert.equal(prompt.promptCalls, 0);
  });

  // @covers csm:BEH-009
  test("aborts when passphrases mismatch and writes no file", async () => {
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha");
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "alpha" })];
    const prompt = new FakeExportPassphrasePrompt();
    prompt.shouldMismatch = true;
    const writer = new FakeExportFileWriter();
    const cipher = new IdentityCipher();
    const clock = new FakeClock();

    await assert.rejects(
      () => new ExportProfiles(repo, credentials, prompt, writer, cipher, clock).execute({
        file: "/tmp/csm.bundle",
      }),
      PassphraseMismatch,
    );
    assert.equal(writer.writes.length, 0);
  });

  // @covers csm:BEH-009
  test("aborts when a profile keychain slot is missing", async () => {
    const credentials = new FakeCredentialStore();
    // store has profile metadata but no keychain blob for "ghost"
    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "ghost" })];
    const prompt = new FakeExportPassphrasePrompt();
    const writer = new FakeExportFileWriter();
    const cipher = new IdentityCipher();
    const clock = new FakeClock();

    await assert.rejects(
      () => new ExportProfiles(repo, credentials, prompt, writer, cipher, clock).execute({
        file: "/tmp/csm.bundle",
      }),
      MissingProfileBlob,
    );
    assert.equal(writer.writes.length, 0);
  });
});

async function makeBundleBytes(
  profiles: Array<{ name: string; blob: string }>,
  passphrase = PASSPHRASE,
  bundleOverrides: Partial<ProfileBundle> = {},
): Promise<Uint8Array> {
  const cipher = new IdentityCipher();
  const bundle: ProfileBundle = {
    version: 1,
    exportedAt: "2026-05-06T00:00:00.000Z",
    profiles: profiles.map(({ name }) => makeProfile({ name })),
    keychainBlobs: Object.fromEntries(
      profiles.map(({ name, blob }) => [
        name,
        Buffer.from(blob, "utf8").toString("base64"),
      ]),
    ),
    ...bundleOverrides,
  };
  const plaintext = Buffer.from(JSON.stringify(bundle), "utf8");
  return cipher.encrypt(passphrase, plaintext);
}

describe("ImportProfiles", () => {
  // @covers csm:BEH-010
  test("imports every profile when target store is empty", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "alpha", blob: "blob-alpha" },
      { name: "personal", blob: "blob-personal" },
    ]);

    const repo = new FakeProfileRepository();
    const credentials = new FakeCredentialStore();
    const prompt = new FakeImportPassphrasePrompt();
    prompt.passphrase = PASSPHRASE;
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();

    const outcome = await new ImportProfiles(
      repo,
      credentials,
      prompt,
      reader,
      cipher,
      marker,
    ).execute({ file: "/tmp/x.bundle", policy: "skipExisting" });

    assert.deepEqual(outcome.imported.sort(), ["alpha", "personal"]);
    assert.deepEqual(outcome.overwritten, []);
    assert.deepEqual(outcome.skipped, []);
    assert.deepEqual(outcome.skippedActive, []);
    assert.equal(repo.file.profiles.length, 2);
    assert.equal(credentials.blobs.get(profileKeychainService("alpha")), "blob-alpha");
    assert.equal(credentials.blobs.get(profileKeychainService("personal")), "blob-personal");
    assert.equal(marker.value, null);
  });

  // @covers csm:BEH-010
  test("skips an existing non-active conflict by default", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "alpha", blob: "blob-alpha-NEW" },
      { name: "fresh", blob: "blob-fresh" },
    ]);

    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "alpha" })];
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha-OLD");
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();

    const outcome = await new ImportProfiles(
      repo,
      credentials,
      prompt,
      reader,
      cipher,
      marker,
    ).execute({ file: "/tmp/x.bundle", policy: "skipExisting" });

    assert.deepEqual(outcome.imported, ["fresh"]);
    assert.deepEqual(outcome.skipped, ["alpha"]);
    assert.equal(credentials.blobs.get(profileKeychainService("alpha")), "blob-alpha-OLD");
  });

  // @covers csm:BEH-010
  test("--overwrite replaces existing non-active profiles", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "alpha", blob: "blob-alpha-NEW" },
    ]);

    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "alpha" })];
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha-OLD");
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();

    const outcome = await new ImportProfiles(
      repo,
      credentials,
      prompt,
      reader,
      cipher,
      marker,
    ).execute({ file: "/tmp/x.bundle", policy: "overwriteAll" });

    assert.deepEqual(outcome.overwritten, ["alpha"]);
    assert.equal(credentials.blobs.get(profileKeychainService("alpha")), "blob-alpha-NEW");
  });

  // @covers csm:BEH-010
  test("--overwrite alone refuses to replace the currently active profile", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "alpha", blob: "blob-alpha-NEW" },
      { name: "other", blob: "blob-other" },
    ]);

    const repo = new FakeProfileRepository();
    repo.file.profiles = [
      makeProfile({ name: "alpha" }),
      makeProfile({ name: "other" }),
    ];
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha-OLD");
    credentials.blobs.set(profileKeychainService("other"), "blob-other-OLD");
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();
    marker.value = "alpha";

    const outcome = await new ImportProfiles(
      repo,
      credentials,
      prompt,
      reader,
      cipher,
      marker,
    ).execute({ file: "/tmp/x.bundle", policy: "overwriteAll" });

    assert.deepEqual(outcome.skippedActive, ["alpha"]);
    assert.deepEqual(outcome.overwritten, ["other"]);
    assert.equal(credentials.blobs.get(profileKeychainService("alpha")), "blob-alpha-OLD");
    assert.equal(credentials.blobs.get(profileKeychainService("other")), "blob-other");
  });

  // @covers csm:BEH-010
  test("--overwrite-active replaces the active profile too", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "alpha", blob: "blob-alpha-NEW" },
    ]);

    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "alpha" })];
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha-OLD");
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();
    marker.value = "alpha";

    const outcome = await new ImportProfiles(
      repo,
      credentials,
      prompt,
      reader,
      cipher,
      marker,
    ).execute({ file: "/tmp/x.bundle", policy: "overwriteIncludingActive" });

    assert.deepEqual(outcome.overwritten, ["alpha"]);
    assert.equal(credentials.blobs.get(profileKeychainService("alpha")), "blob-alpha-NEW");
  });

  // @covers csm:BEH-010
  test("exits with AllSkippedActive when every bundle profile is the active one", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "alpha", blob: "blob-alpha-NEW" },
    ]);

    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "alpha" })];
    const credentials = new FakeCredentialStore();
    credentials.blobs.set(profileKeychainService("alpha"), "blob-alpha-OLD");
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();
    marker.value = "alpha";

    await assert.rejects(
      () => new ImportProfiles(repo, credentials, prompt, reader, cipher, marker).execute({
        file: "/tmp/x.bundle",
        policy: "overwriteAll",
      }),
      AllSkippedActive,
    );
    assert.equal(credentials.blobs.get(profileKeychainService("alpha")), "blob-alpha-OLD");
  });

  // @covers csm:BEH-010
  test("never touches the active marker", async () => {
    const fileBytes = await makeBundleBytes([
      { name: "fresh", blob: "blob-fresh" },
    ]);

    const repo = new FakeProfileRepository();
    repo.file.profiles = [makeProfile({ name: "alpha" })];
    const credentials = new FakeCredentialStore();
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();
    marker.value = "alpha";

    await new ImportProfiles(repo, credentials, prompt, reader, cipher, marker).execute({
      file: "/tmp/x.bundle",
      policy: "skipExisting",
    });

    assert.equal(marker.value, "alpha");
  });

  // @covers csm:BEH-010
  test("rejects bundle whose version != 1", async () => {
    const fileBytes = await makeBundleBytes(
      [{ name: "alpha", blob: "blob-alpha" }],
      PASSPHRASE,
      { version: 2 as unknown as 1 },
    );

    const repo = new FakeProfileRepository();
    const credentials = new FakeCredentialStore();
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new ImportProfiles(repo, credentials, prompt, reader, cipher, marker).execute({
        file: "/tmp/x.bundle",
        policy: "skipExisting",
      }),
      UnsupportedBundleVersion,
    );
    assert.equal(repo.writes, 0);
  });

  // @covers csm:BEH-010
  test("rejects bundle with malformed plaintext (not a JSON object)", async () => {
    const cipher = new IdentityCipher();
    const fileBytes = await cipher.encrypt(PASSPHRASE, Buffer.from("not json", "utf8"));

    const repo = new FakeProfileRepository();
    const credentials = new FakeCredentialStore();
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new ImportProfiles(repo, credentials, prompt, reader, cipher, marker).execute({
        file: "/tmp/x.bundle",
        policy: "skipExisting",
      }),
      MalformedBundle,
    );
  });

  // @covers csm:BEH-010
  test("rejects bundle whose profile name violates the regex", async () => {
    const cipher = new IdentityCipher();
    const bundle = {
      version: 1,
      exportedAt: "2026-05-06T00:00:00.000Z",
      profiles: [{ ...makeProfile({ name: "alpha" }), name: "bad name with space" }],
      keychainBlobs: { "bad name with space": Buffer.from("blob", "utf8").toString("base64") },
    };
    const fileBytes = await cipher.encrypt(PASSPHRASE, Buffer.from(JSON.stringify(bundle), "utf8"));

    const repo = new FakeProfileRepository();
    const credentials = new FakeCredentialStore();
    const prompt = new FakeImportPassphrasePrompt();
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new ImportProfiles(repo, credentials, prompt, reader, cipher, marker).execute({
        file: "/tmp/x.bundle",
        policy: "skipExisting",
      }),
      InvalidProfileName,
    );
    assert.equal(repo.writes, 0);
  });

  // @covers csm:BEH-010
  test("propagates BadPassphrase from the cipher when wrong passphrase", async () => {
    const fileBytes = await makeBundleBytes([{ name: "alpha", blob: "blob" }]);

    const repo = new FakeProfileRepository();
    const credentials = new FakeCredentialStore();
    const prompt = new FakeImportPassphrasePrompt();
    prompt.passphrase = "WRONG";
    const reader = new FakeImportFileReader();
    reader.buffers.set("/tmp/x.bundle", fileBytes);
    const cipher = new IdentityCipher();
    const marker = new FakeActiveMarker();

    await assert.rejects(
      () => new ImportProfiles(repo, credentials, prompt, reader, cipher, marker).execute({
        file: "/tmp/x.bundle",
        policy: "skipExisting",
      }),
      BadPassphrase,
    );
    assert.equal(repo.writes, 0);
    assert.equal(credentials.blobs.size, 0);
  });
});
