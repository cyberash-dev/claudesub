import { createDecipheriv, scryptSync } from "node:crypto";
import {
  BadPassphrase,
  MalformedBundle,
  UnsupportedBundleVersion,
} from "../../domain/ImportOutcome.js";
import type { ImportCipher } from "../../ports/outbound/ImportCipher.js";

const MAGIC = Buffer.from("CSMEXP\x00", "ascii");
const FILE_VERSION = 0x01;
const HEADER_LEN = 40;
const TAG_LEN = 16;
const MIN_FILE_LEN = HEADER_LEN + TAG_LEN;
const KEY_LEN = 32;
const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export class NodeCryptoImportCipher implements ImportCipher {
  async decrypt(passphrase: string, fileBytes: Uint8Array): Promise<Uint8Array> {
    const buf = Buffer.from(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength);

    if (buf.length < MIN_FILE_LEN) {
      throw new MalformedBundle("file shorter than the minimum header+tag size");
    }
    if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new MalformedBundle("magic mismatch (not a CSMEXP bundle)");
    }
    const version = buf.readUInt8(MAGIC.length);
    if (version !== FILE_VERSION) {
      throw new UnsupportedBundleVersion(version);
    }
    const salt = buf.subarray(8, 24);
    const iv = buf.subarray(24, 36);
    const ciphertextLen = buf.readUInt32BE(36);
    if (ciphertextLen < TAG_LEN) {
      throw new MalformedBundle("ciphertext_len smaller than the GCM tag");
    }
    if (HEADER_LEN + ciphertextLen !== buf.length) {
      throw new MalformedBundle("ciphertext_len does not match the available bytes");
    }
    const aad = buf.subarray(0, HEADER_LEN);
    const ciphertext = buf.subarray(HEADER_LEN, HEADER_LEN + ciphertextLen - TAG_LEN);
    const tag = buf.subarray(HEADER_LEN + ciphertextLen - TAG_LEN, HEADER_LEN + ciphertextLen);

    const key = scryptSync(passphrase, salt, KEY_LEN, SCRYPT_PARAMS);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new BadPassphrase();
    }
  }
}
