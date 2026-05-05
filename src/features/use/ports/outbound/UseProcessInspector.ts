export interface RunningClaudeProcess {
  pid: number;
  command: string;
}

export interface UseProcessInspector {
  findRunning(): Promise<RunningClaudeProcess[]>;
}
