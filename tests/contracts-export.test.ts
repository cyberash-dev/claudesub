import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { NodeCryptoExportCipher } from "../src/features/export/adapters/outbound/NodeCryptoExportCipher.js";
import { NodeCryptoImportCipher } from "../src/features/import/adapters/outbound/NodeCryptoImportCipher.js";
import {
  BadPassphrase,
  MalformedBundle,
  UnsupportedBundleVersion,
} from "../src/features/import/domain/ImportOutcome.js";

const PASSPHRASE = "round-trip-pass-1234";

describe("CON-009 / EXT-005 cipher byte layout", () => {
  // @covers csm:CON-009
  // @covers csm:EXT-005
  // @covers csm:DELTA-002
  test("emitted file starts with CSMEXP\\0 + version byte 0x01", async () => {
    const cipher = new NodeCryptoExportCipher();
    const out = await cipher.encrypt(PASSPHRASE, Buffer.from("payload", "utf8"));
    const buf = Buffer.from(out);

    assert.equal(buf.subarray(0, 7).toString("ascii"), "CSMEXP\x00");
    assert.equal(buf.readUInt8(7), 0x01);
  });

  // @covers csm:CON-009
  test("ciphertext_len field equals plaintext.length + 16-byte tag", async () => {
    const cipher = new NodeCryptoExportCipher();
    const plaintext = Buffer.from("0123456789", "utf8");
    const out = Buffer.from(await cipher.encrypt(PASSPHRASE, plaintext));

    const ciphertextLen = out.readUInt32BE(36);
    assert.equal(ciphertextLen, plaintext.length + 16);
    assert.equal(out.length, 40 + ciphertextLen);
  });

  // @covers csm:POL-004
  test("two encrypts of identical plaintext + passphrase produce different files (random salt + IV)", async () => {
    const cipher = new NodeCryptoExportCipher();
    const plaintext = Buffer.from("same-payload", "utf8");
    const a = Buffer.from(await cipher.encrypt(PASSPHRASE, plaintext));
    const b = Buffer.from(await cipher.encrypt(PASSPHRASE, plaintext));

    // Salt at [8..24) and IV at [24..36) must differ.
    assert.notEqual(a.subarray(8, 24).toString("hex"), b.subarray(8, 24).toString("hex"));
    assert.notEqual(a.subarray(24, 36).toString("hex"), b.subarray(24, 36).toString("hex"));
    // Whole-file inequality.
    assert.notEqual(a.toString("hex"), b.toString("hex"));
  });

  // @covers csm:CON-009
  // @covers csm:EXT-005
  // @covers csm:DELTA-003
  test("encrypt → decrypt round-trip recovers plaintext byte-for-byte", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const plaintext = Buffer.from("hello world — секрет — \u{1F511}", "utf8");

    const file = await enc.encrypt(PASSPHRASE, plaintext);
    const recovered = Buffer.from(await dec.decrypt(PASSPHRASE, file));

    assert.equal(recovered.toString("utf8"), plaintext.toString("utf8"));
  });

  // @covers csm:POL-004
  test("flipping a byte in the AAD header invalidates the GCM tag", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const file = Buffer.from(await enc.encrypt(PASSPHRASE, Buffer.from("payload", "utf8")));

    file[10] = (file[10] ?? 0) ^ 0xff; // somewhere inside the salt range, still part of AAD

    await assert.rejects(() => dec.decrypt(PASSPHRASE, file), BadPassphrase);
  });

  // @covers csm:POL-004
  test("flipping a byte in the ciphertext range invalidates the GCM tag", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const file = Buffer.from(await enc.encrypt(PASSPHRASE, Buffer.from("payload", "utf8")));

    file[file.length - 1] = (file[file.length - 1] ?? 0) ^ 0xff; // last byte of GCM tag
    await assert.rejects(() => dec.decrypt(PASSPHRASE, file), BadPassphrase);
  });

  // @covers csm:CON-009
  test("decrypt rejects a magic mismatch", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const file = Buffer.from(await enc.encrypt(PASSPHRASE, Buffer.from("p", "utf8")));
    file[0] = 0x42; // break magic

    await assert.rejects(() => dec.decrypt(PASSPHRASE, file), MalformedBundle);
  });

  // @covers csm:CON-009
  test("decrypt rejects a file whose version byte is not 0x01", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const file = Buffer.from(await enc.encrypt(PASSPHRASE, Buffer.from("p", "utf8")));
    file[7] = 0x99;

    await assert.rejects(() => dec.decrypt(PASSPHRASE, file), UnsupportedBundleVersion);
  });

  // @covers csm:CON-009
  test("decrypt rejects a truncated file", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const file = Buffer.from(await enc.encrypt(PASSPHRASE, Buffer.from("payload-truncate", "utf8")));
    const truncated = file.subarray(0, file.length - 4);

    await assert.rejects(() => dec.decrypt(PASSPHRASE, truncated), MalformedBundle);
  });

  // @covers csm:BEH-010
  test("decrypt with the wrong passphrase fails as BadPassphrase", async () => {
    const enc = new NodeCryptoExportCipher();
    const dec = new NodeCryptoImportCipher();
    const file = await enc.encrypt(PASSPHRASE, Buffer.from("payload", "utf8"));

    await assert.rejects(() => dec.decrypt("WRONG", file), BadPassphrase);
  });
});
