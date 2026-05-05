export interface AddPrompt {
  printPlan(name: string): Promise<void>;
  askYesNo(question: string): Promise<boolean>;
  waitForEnter(question: string): Promise<void>;
}
