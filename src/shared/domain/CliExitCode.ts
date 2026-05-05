export type CliExitCode = 0 | 1 | 2;

export const EXIT_OK: CliExitCode = 0;
export const EXIT_RUNTIME: CliExitCode = 1;
export const EXIT_USAGE: CliExitCode = 2;
