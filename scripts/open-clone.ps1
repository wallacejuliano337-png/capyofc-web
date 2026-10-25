Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class WinDesktopLauncherApp {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    public const uint NORMAL_PRIORITY_CLASS = 0x00000020;
    public const uint CREATE_NEW_PROCESS_GROUP = 0x00000200;

    public static int Launch(string appPath, string cmdLine, string workDir) {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"WinSta0\Default";

        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        bool success = CreateProcess(
            appPath,
            cmdLine,
            IntPtr.Zero,
            IntPtr.Zero,
            false,
            NORMAL_PRIORITY_CLASS | CREATE_NEW_PROCESS_GROUP,
            IntPtr.Zero,
            workDir,
            ref si,
            out pi
        );

        if (!success) {
            int err = Marshal.GetLastWin32Error();
            throw new System.ComponentModel.Win32Exception(err);
        }

        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return pi.dwProcessId;
    }
}
'@

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

$browserPath = if (Test-Path $chromePath) { $chromePath } else { $edgePath }
$url = "http://localhost:3000"
$args = "`"$browserPath`" --app=$url --window-size=1280,820"

$pidApp = [WinDesktopLauncherApp]::Launch($browserPath, $args, "d:\LYC-Arena\discord-clone")
Write-Output "SUCCESS: App window launched on WinSta0\Default with PID: $pidApp"
