export interface ImportCipher {
  decrypt(passphrase: string, fileBytes: Uint8Array): Promise<Uint8Array>;
}
