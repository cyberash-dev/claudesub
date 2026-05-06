import { profileKeychainService } from "../../../shared/domain/ServiceNames.js";
import type { ProfileBundle } from "../../../shared/domain/ProfileBundle.js";
import {
  MissingProfileBlob,
  NoProfilesToExport,
  type ExportOutcome,
} from "../domain/ExportOutcome.js";
import type {
  ExportCommand,
  ExportCommandInput,
} from "../ports/inbound/ExportCommand.js";
import type { ExportProfileRepository } from "../ports/outbound/ExportProfileRepository.js";
import type { ExportCredentialStore } from "../ports/outbound/ExportCredentialStore.js";
import type { ExportPassphrasePrompt } from "../ports/outbound/ExportPassphrasePrompt.js";
import type { ExportFileWriter } from "../ports/outbound/ExportFileWriter.js";
import type { ExportCipher } from "../ports/outbound/ExportCipher.js";
import type { ExportClock } from "../ports/outbound/ExportClock.js";

export class ExportProfiles implements ExportCommand {
  constructor(
    private readonly repo: ExportProfileRepository,
    private readonly credentials: ExportCredentialStore,
    private readonly prompt: ExportPassphrasePrompt,
    private readonly writer: ExportFileWriter,
    private readonly cipher: ExportCipher,
    private readonly clock: ExportClock,
  ) {}

  async execute(input: ExportCommandInput): Promise<ExportOutcome> {
    const file = await this.repo.read();
    if (file.profiles.length === 0) {
      throw new NoProfilesToExport();
    }

    const keychainBlobs: Record<string, string> = {};
    for (const profile of file.profiles) {
      let blob: string;
      try {
        blob = await this.credentials.readProfile(profileKeychainService(profile.name));
      } catch {
        throw new MissingProfileBlob(profile.name);
      }
      keychainBlobs[profile.name] = Buffer.from(blob, "utf8").toString("base64");
    }

    const exportedAt = this.clock.nowIso();
    const bundle: ProfileBundle = {
      version: 1,
      exportedAt,
      profiles: file.profiles,
      keychainBlobs,
    };
    const plaintext = Buffer.from(JSON.stringify(bundle), "utf8");

    const passphrase = await this.prompt.promptNew();
    const ciphertext = await this.cipher.encrypt(passphrase, plaintext);
    await this.writer.write(input.file, ciphertext);

    return {
      filePath: input.file,
      profileCount: file.profiles.length,
      exportedAt,
    };
  }
}
