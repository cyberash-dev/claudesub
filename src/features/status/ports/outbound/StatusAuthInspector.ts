export interface StatusAuthInspectorResult {
  loggedIn?: boolean;
  authMethod?: string;
  apiProvider?: string;
  email?: string;
  orgId?: string;
  orgName?: string;
  subscriptionType?: string;
  raw?: string;
  error?: string;
}

export interface StatusAuthInspector {
  fetch(): Promise<StatusAuthInspectorResult>;
}
