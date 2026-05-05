const PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

export class ProfileName {
  private constructor(public readonly value: string) {}

  static parse(raw: string): ProfileName {
    if (!PATTERN.test(raw)) {
      throw new InvalidProfileName(raw);
    }
    return new ProfileName(raw);
  }

  static isValid(raw: string): boolean {
    return PATTERN.test(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ProfileName): boolean {
    return this.value === other.value;
  }
}

export class InvalidProfileName extends Error {
  constructor(public readonly raw: string) {
    super(`Invalid profile name: "${raw}". Allowed: [a-zA-Z0-9._-], 1..64 chars.`);
    this.name = "InvalidProfileName";
  }
}
