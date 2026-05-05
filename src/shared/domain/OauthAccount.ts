export type OauthAccount = Record<string, unknown>;

export function readString(account: OauthAccount, key: string): string {
  const v = account[key];
  return typeof v === "string" ? v : "";
}

export function extractSubscriptionType(account: OauthAccount): string {
  for (const key of ["subscriptionType", "billingType", "seatTier"]) {
    const v = account[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

export function readAccountUuid(account: OauthAccount): string | undefined {
  const v = account.accountUuid;
  return typeof v === "string" ? v : undefined;
}
