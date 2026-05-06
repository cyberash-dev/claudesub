import { spawn } from "node:child_process";

export class WincredEntryNotFound extends Error {
  constructor(target: string) {
    super(`Credential Manager entry "${target}" not found.`);
    this.name = "WincredEntryNotFound";
  }
}

export class WincredUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "WincredUnavailable";
  }
}

export async function wincredRead(target: string): Promise<string> {
  guardEnvironment();
  const script = `${PINVOKE_DEFS}
$ErrorActionPreference = 'Stop'
$ptr = [IntPtr]::Zero
$ok = [CsmWincred.Native]::CredReadW($env:CSM_WINCRED_TARGET, 1, 0, [ref]$ptr)
if (-not $ok) {
  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($err -eq 1168) { exit 2 }
  Write-Error ("CredReadW failed (Win32 error " + $err + ")")
  exit 1
}
$cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type]([CsmWincred.Native+CREDENTIAL]))
$bytes = New-Object byte[] $cred.CredentialBlobSize
if ($cred.CredentialBlobSize -gt 0) {
  [System.Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
}
[CsmWincred.Native]::CredFree($ptr) | Out-Null
[Console]::Out.Write([Convert]::ToBase64String($bytes))
exit 0`;
  const res = await runPowerShell(script, { CSM_WINCRED_TARGET: target }, null);
  if (res.code === 2) throw new WincredEntryNotFound(target);
  if (res.code !== 0) {
    throw new Error(`PowerShell CredRead failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
  const buf = Buffer.from(res.stdout.trim(), "base64");
  return buf.toString("utf8");
}

export async function wincredWrite(target: string, blob: string, userName: string): Promise<void> {
  guardEnvironment();
  const script = `${PINVOKE_DEFS}
$ErrorActionPreference = 'Stop'
$base64 = [Console]::In.ReadToEnd().Trim()
$bytes = [Convert]::FromBase64String($base64)
$ptr = [IntPtr]::Zero
try {
  if ($bytes.Length -gt 0) {
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
  }
  $cred = New-Object CsmWincred.Native+CREDENTIAL
  $cred.Flags = 0
  $cred.Type = 1
  $cred.TargetName = $env:CSM_WINCRED_TARGET
  $cred.Comment = ""
  $cred.CredentialBlobSize = $bytes.Length
  $cred.CredentialBlob = $ptr
  $cred.Persist = 2
  $cred.AttributeCount = 0
  $cred.Attributes = [IntPtr]::Zero
  $cred.TargetAlias = ""
  $cred.UserName = $env:CSM_WINCRED_USERNAME
  $ok = [CsmWincred.Native]::CredWriteW([ref]$cred, 0)
  if (-not $ok) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Error ("CredWriteW failed (Win32 error " + $err + ")")
    exit 1
  }
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr) }
}
exit 0`;
  const base64 = Buffer.from(blob, "utf8").toString("base64");
  const res = await runPowerShell(
    script,
    { CSM_WINCRED_TARGET: target, CSM_WINCRED_USERNAME: userName },
    base64,
  );
  if (res.code !== 0) {
    throw new Error(`PowerShell CredWrite failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
}

export async function wincredDelete(target: string): Promise<boolean> {
  guardEnvironment();
  const script = `${PINVOKE_DEFS}
$ErrorActionPreference = 'Stop'
$ok = [CsmWincred.Native]::CredDeleteW($env:CSM_WINCRED_TARGET, 1, 0)
if (-not $ok) {
  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if ($err -eq 1168) { exit 2 }
  Write-Error ("CredDeleteW failed (Win32 error " + $err + ")")
  exit 1
}
exit 0`;
  const res = await runPowerShell(script, { CSM_WINCRED_TARGET: target }, null);
  if (res.code === 2) return false;
  if (res.code !== 0) {
    throw new Error(`PowerShell CredDelete failed (exit ${res.code}): ${res.stderr.trim()}`);
  }
  return true;
}

function guardEnvironment(): void {
  if (process.env["MSYSTEM"]) {
    throw new WincredUnavailable(
      "Windows Credential Manager is not reachable from MSYS / Git Bash " +
      "(see anthropics/claude-code#29049). Run claudesub from PowerShell or cmd.exe.",
    );
  }
}

interface PsResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runPowerShell(
  script: string,
  envExtras: Record<string, string>,
  stdin: string | null,
): Promise<PsResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...envExtras },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new WincredUnavailable("powershell.exe not found on PATH."));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    if (stdin === null) {
      child.stdin.end();
    } else {
      child.stdin.end(stdin);
    }
  });
}

const PINVOKE_DEFS = `
Add-Type -ErrorAction SilentlyContinue -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace CsmWincred {
  public class Native {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
      public uint Flags;
      public uint Type;
      [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
      [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
      public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
      public uint CredentialBlobSize;
      public IntPtr CredentialBlob;
      public uint Persist;
      public uint AttributeCount;
      public IntPtr Attributes;
      [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
      [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
    }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredReadW(string target, uint type, uint flags, out IntPtr CredentialPtr);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWriteW(ref CREDENTIAL cred, uint flags);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredDeleteW(string target, uint type, uint flags);
    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr Buffer);
  }
}
"@
`;
