export interface ExportCipher {
  encrypt(passphrase: string, plaintext: Uint8Array): Promise<Uint8Array>;
}
