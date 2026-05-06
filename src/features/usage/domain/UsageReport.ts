export type UsageBucketId =
  | "five_hour"
  | "seven_day"
  | "seven_day_sonnet"
  | "seven_day_opus";

export interface UsageBucket {
  id: UsageBucketId;
  utilizationPercent: number;
  resetsAt: string;
}

export interface ExtraUsageBucket {
  monthlyLimitUsdMinor: number | null;
  usedUsdMinor: number;
}

export interface UsageReport {
  buckets: UsageBucket[];
  extra: ExtraUsageBucket | null;
  fetchedAt: string;
}

export const BUCKET_ORDER: readonly UsageBucketId[] = [
  "five_hour",
  "seven_day",
  "seven_day_sonnet",
  "seven_day_opus",
];

export const BUCKET_LABEL: Readonly<Record<UsageBucketId, string>> = {
  five_hour: "5-hour",
  seven_day: "weekly",
  seven_day_sonnet: "weekly Sonnet",
  seven_day_opus: "weekly Opus",
};
