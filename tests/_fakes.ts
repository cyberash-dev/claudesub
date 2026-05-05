import {
  emptyProfilesFile,
  type ProfilesFile,
} from "../src/shared/domain/ProfilesFile.js";
import type { ProfileMetadata } from "../src/shared/domain/ProfileMetadata.js";
import type { OauthAccount } from "../src/shared/domain/OauthAccount.js";

export class FakeCredentialStore {
  blobs = new Map<string, string>();
  liveBlob: string | null = null;

  async readLive(): Promise<string> {
    if (this.liveBlob === null) throw new Error('Live keychain entry "Claude Code-credentials" not found.');
    return this.liveBlob;
  }
  async writeLive(blob: string): Promise<void> {
    this.liveBlob = blob;
  }
  async readProfile(service: string): Promise<string> {
    return this.read(service);
  }
  async writeProfile(service: string, blob: string): Promise<void> {
    this.write(service, blob);
  }
  async deleteProfile(service: string): Promise<boolean> {
    return this.blobs.delete(service);
  }
  async read(service: string): Promise<string> {
    const v = this.blobs.get(service);
    if (v === undefined) throw new Error(`Keychain entry "${service}" not found.`);
    return v;
  }
  async write(service: string, blob: string): Promise<void> {
    this.blobs.set(service, blob);
  }
  async delete(service: string): Promise<void> {
    this.blobs.delete(service);
  }
}

export class FakeProfileRepository {
  file: ProfilesFile = emptyProfilesFile();
  writes = 0;
  async read(): Promise<ProfilesFile> {
    return JSON.parse(JSON.stringify(this.file)) as ProfilesFile;
  }
  async write(file: ProfilesFile): Promise<void> {
    this.file = JSON.parse(JSON.stringify(file)) as ProfilesFile;
    this.writes++;
  }
}

export class FakeActiveMarker {
  value: string | null = null;
  async read(): Promise<string | null> {
    return this.value;
  }
  async write(name: string): Promise<void> {
    this.value = name;
  }
  async clear(): Promise<void> {
    this.value = null;
  }
}

export class FakeStatusClaudeJsonReader {
  oauthAccount: OauthAccount | undefined = undefined;
  userID: string | undefined = undefined;
  fileMissing = false;
  async read(): Promise<{ oauthAccount: OauthAccount | undefined; userID: string | undefined } | null> {
    if (this.fileMissing) return null;
    return { oauthAccount: this.oauthAccount, userID: this.userID };
  }
}

export class FakeSaveClaudeJsonReader {
  oauthAccount: OauthAccount | undefined = undefined;
  userID: string | undefined = undefined;
  async read(): Promise<{ oauthAccount: OauthAccount | undefined; userID: string | undefined }> {
    return { oauthAccount: this.oauthAccount, userID: this.userID };
  }
}

export class FakeClaudeJsonWriter {
  patches: Array<{ oauthAccount: OauthAccount; userID: string }> = [];
  async patch(oauthAccount: OauthAccount, userID: string): Promise<void> {
    this.patches.push({ oauthAccount, userID });
  }
  last(): { oauthAccount: OauthAccount; userID: string } | undefined {
    return this.patches[this.patches.length - 1];
  }
}

export class FakeProcessInspector {
  running: Array<{ pid: number; command: string }> = [];
  async findRunning(): Promise<Array<{ pid: number; command: string }>> {
    return this.running;
  }
}

export class FakeAuthVerifier {
  result: { ok: boolean; summary: string } = { ok: true, summary: "loggedIn as test@example.com (max)" };
  calls = 0;
  async verify(): Promise<{ ok: boolean; summary: string }> {
    this.calls++;
    return this.result;
  }
}

export class FakeAuthInspector {
  payload: Record<string, unknown> = { loggedIn: true, email: "test@example.com", subscriptionType: "max" };
  async fetch(): Promise<Record<string, unknown>> {
    return this.payload;
  }
}

export class FakeClock {
  current = "2026-05-05T12:00:00.000Z";
  ticks = 0;
  nowIso(): string {
    this.ticks++;
    return this.current;
  }
}

export class FakeConfirmer {
  shouldConfirm = true;
  prompts: string[] = [];
  async confirmName(name: string): Promise<boolean> {
    this.prompts.push(name);
    return this.shouldConfirm;
  }
}

export class FakePrompt {
  yesNoAnswer = true;
  enterCalls = 0;
  planPrints: string[] = [];
  async printPlan(name: string): Promise<void> {
    this.planPrints.push(name);
  }
  async askYesNo(_question: string): Promise<boolean> {
    return this.yesNoAnswer;
  }
  async waitForEnter(_question: string): Promise<void> {
    this.enterCalls++;
  }
}

export class FakeLogout {
  exitCode = 0;
  calls = 0;
  async run(): Promise<number> {
    this.calls++;
    return this.exitCode;
  }
}

export class FakeSnapshotter {
  names: string[] = [];
  async snapshot(name: string): Promise<void> {
    this.names.push(name);
  }
}

export function makeProfile(overrides: Partial<ProfileMetadata> = {}): ProfileMetadata {
  return {
    name: "test",
    oauthAccount: { accountUuid: "uuid-test", emailAddress: "test@example.com", organizationName: "Test Org", billingType: "max" },
    userID: "user-test",
    email: "test@example.com",
    orgName: "Test Org",
    subscriptionType: "max",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
