import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import type { ExportCipher } from "../../ports/outbound/ExportCipher.js";

const MAGIC = Buffer.from("CSMEXP\x00", "ascii");
const FILE_VERSION = 0x01;
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 32;
const TAG_LEN = 16;
const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export class NodeCryptoExportCipher implements ExportCipher {
  async encrypt(passphrase: string, plaintext: Uint8Array): Promise<Uint8Array> {
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = scryptSync(passphrase, salt, KEY_LEN, SCRYPT_PARAMS);

    const ciphertextLenBuf = Buffer.alloc(4);
    ciphertextLenBuf.writeUInt32BE(plaintext.length + TAG_LEN, 0);

    const aad = Buffer.concat([
      MAGIC,
      Buffer.from([FILE_VERSION]),
      salt,
      iv,
      ciphertextLenBuf,
    ]);

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad);
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([aad, body, tag]);
  }
}
