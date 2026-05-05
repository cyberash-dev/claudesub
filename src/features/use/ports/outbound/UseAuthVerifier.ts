export interface UseAuthVerifierResult {
  ok: boolean;
  summary: string;
}

export interface UseAuthVerifier {
  verify(): Promise<UseAuthVerifierResult>;
}
