import type { StatusAuthInspectorResult } from "../ports/outbound/StatusAuthInspector.js";

export interface StatusClaudeJsonSummary {
  userID: string | null;
  accountUuid: string | null;
  emailAddress: string | null;
}

export interface StatusReport {
  active: string | null;
  profileKnown: boolean;
  claudeJson: StatusClaudeJsonSummary | null;
  desyncReason: string | null;
  authStatus: StatusAuthInspectorResult;
}
