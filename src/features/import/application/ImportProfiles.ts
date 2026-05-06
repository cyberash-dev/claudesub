import { InvalidProfileName, ProfileName } from "../../../shared/domain/ProfileName.js";
import { profileKeychainService } from "../../../shared/domain/ServiceNames.js";
import { findProfile, upsertProfile, type ProfilesFile } from "../../../shared/domain/ProfilesFile.js";
import type { ProfileBundle } from "../../../shared/domain/ProfileBundle.js";
import type { ProfileMetadata } from "../../../shared/domain/ProfileMetadata.js";
import {
  AllSkippedActive,
  MalformedBundle,
  UnsupportedBundleVersion,
  type ImportOutcome,
} from "../domain/ImportOutcome.js";
import type {
  ImportCommand,
  ImportCommandInput,
} from "../ports/inbound/ImportCommand.js";
import type { ImportProfileRepository } from "../ports/outbound/ImportProfileRepository.js";
import type { ImportCredentialStore } from "../ports/outbound/ImportCredentialStore.js";
import type { ImportPassphrasePrompt } from "../ports/outbound/ImportPassphrasePrompt.js";
import type { ImportFileReader } from "../ports/outbound/ImportFileReader.js";
import type { ImportCipher } from "../ports/outbound/ImportCipher.js";
import type { ImportActiveMarker } from "../ports/outbound/ImportActiveMarker.js";

interface ImportNotifier {
  onSkippedActive?(name: string): void;
}

export class ImportProfiles implements ImportCommand {
  constructor(
    private readonly repo: ImportProfileRepository,
    private readonly credentials: ImportCredentialStore,
    private readonly prompt: ImportPassphrasePrompt,
    private readonly fileReader: ImportFileReader,
    private readonly cipher: ImportCipher,
    private readonly activeMarker: ImportActiveMarker,
    private readonly notifier: ImportNotifier = {},
  ) {}

  async execute(input: ImportCommandInput): Promise<ImportOutcome> {
    const fileBytes = await this.fileReader.read(input.file);
    const passphrase = await this.prompt.promptExisting();
    const plaintext = await this.cipher.decrypt(passphrase, fileBytes);

    const bundle = this.parseBundle(plaintext);
    for (const profile of bundle.profiles) {
      ProfileName.parse(profile.name);
    }

    const existing = await this.repo.read();
    const activeName = await this.activeMarker.read();

    let workingFile: ProfilesFile = existing;
    const imported: string[] = [];
    const overwritten: string[] = [];
    const skipped: string[] = [];
    const skippedActive: string[] = [];

    for (const profile of bundle.profiles) {
      const isExisting = !!findProfile(workingFile, profile.name);
      const isActive = activeName !== null && profile.name === activeName;
      const action = this.classify(isExisting, isActive, input.policy);

      if (action === "import" || action === "overwrite") {
        const blobBase64 = bundle.keychainBlobs[profile.name];
        if (typeof blobBase64 !== "string") {
          throw new MalformedBundle(`missing keychainBlobs entry for "${profile.name}"`);
        }
        const blob = Buffer.from(blobBase64, "base64").toString("utf8");
        await this.credentials.writeProfile(profileKeychainService(profile.name), blob);
        workingFile = upsertProfile(workingFile, profile);
        (action === "import" ? imported : overwritten).push(profile.name);
      } else if (action === "skip-active") {
        skippedActive.push(profile.name);
        this.notifier.onSkippedActive?.(profile.name);
      } else {
        skipped.push(profile.name);
      }
    }

    if (imported.length > 0 || overwritten.length > 0) {
      await this.repo.write(workingFile);
    }

    if (
      bundle.profiles.length > 0 &&
      skippedActive.length === bundle.profiles.length
    ) {
      throw new AllSkippedActive(skippedActive);
    }

    return { imported, overwritten, skipped, skippedActive };
  }

  private parseBundle(plaintext: Uint8Array): ProfileBundle {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(plaintext).toString("utf8"));
    } catch (err) {
      throw new MalformedBundle(
        err instanceof Error ? err.message : "plaintext is not valid JSON",
      );
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new MalformedBundle("plaintext is not a JSON object");
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1) {
      throw new UnsupportedBundleVersion(obj.version);
    }
    if (!Array.isArray(obj.profiles)) {
      throw new MalformedBundle("`profiles` is not an array");
    }
    if (
      typeof obj.keychainBlobs !== "object" ||
      obj.keychainBlobs === null ||
      Array.isArray(obj.keychainBlobs)
    ) {
      throw new MalformedBundle("`keychainBlobs` is not an object");
    }
    if (typeof obj.exportedAt !== "string") {
      throw new MalformedBundle("`exportedAt` is not a string");
    }
    return {
      version: 1,
      exportedAt: obj.exportedAt,
      profiles: obj.profiles as ProfileMetadata[],
      keychainBlobs: obj.keychainBlobs as Record<string, string>,
    };
  }

  private classify(
    isExisting: boolean,
    isActive: boolean,
    policy: ImportCommandInput["policy"],
  ): "import" | "overwrite" | "skip" | "skip-active" {
    if (!isExisting) return "import";
    if (isActive) {
      return policy === "overwriteIncludingActive" ? "overwrite" : "skip-active";
    }
    if (policy === "overwriteAll" || policy === "overwriteIncludingActive") {
      return "overwrite";
    }
    return "skip";
  }
}

export { InvalidProfileName };
