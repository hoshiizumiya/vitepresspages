# Auto Start Application on Windows with Elevated Privileges
# 自启动应用程序（以管理员权限）

如果只需要当前用户自启，可用注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 或创建快捷方式放入 Startup 文件夹（但这些方法无法实现“以管理员权限自动提升”（不弹UAC的方式））
- 下面是 .NET 的实现，使用 Windows 任务计划程序（Task Scheduler）创建一个开机自启任务，可以选择是否以提升权限运行。
```Csharp
private void RegisterAutoStartTask(bool runElevated)
{
    // Prefer using schtasks.exe for simplicity and less COM code.
    // Build command to create or update task for current user.    {
    string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? string.Empty;
    if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
    {
        throw HutaoException.InvalidOperation("Cannot find executable path to register autostart task.");
    }

    // schtasks arguments
    // /RL HIGHEST for elevated, otherwise LIMITED
    string runLevel = runElevated ? "HIGHEST" : "LIMITED";

    // /RU <User> omitted to use current user interactive token with /RL HIGHEST and /F
    // Create task that runs at logon
    string arguments = $"/Create /TN \"{TaskName}\" /TR \"\\\"{exePath}\\\"\" /SC ONLOGON /RL {runLevel} /F";

    Debug.WriteLine($"Registering autostart task with arguments: {arguments}");

    ProcessStartInfo psi = new()
    {
        FileName = "schtasks.exe",
        Arguments = arguments,
        CreateNoWindow = true,
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
    };

    using Process proc = Process.Start(psi)!;
    string stdout = proc.StandardOutput.ReadToEnd();
    string stderr = proc.StandardError.ReadToEnd();
    proc.WaitForExit();

    if (proc.ExitCode != 0)
    {
        // 将 stdout/stderr 一并记录，便于后续定位权限或参数问题
        throw HutaoException.InvalidOperation($"Failed to register autostart task. ExitCode: {proc.ExitCode}. stdout: {stdout}. stderr: {stderr}");
    }
}
```

- 权限：创建计划任务，无论是不是带 HIGHEST 的任务都需要管理员身份。考虑判断并给出友好提示。
- `RegisterAutoStartTask(bool runElevated)`
  - 获取当前进程的可执行文件路径：
    - `string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? string.Empty;`
    - 如果路径为空或文件不存在则抛出异常。
    - `runElevated` 参数决定任务是否以提升权限运行。你应该根据需要传入 true 或 false，它需要从本地的设置内容中读取并在合适的启动后的时间运行此方法以确保设置和实际相对应（每次启动！用户可能移动应用或重做系统吧）。
  - 决定运行级别：`runElevated ? "HIGHEST" : "LIMITED"`。HIGHEST 表示任务以提升（管理员）权限运行，见 win+X 呼出图在左下角![TaskScheduler](https://testingcf.jsdelivr.net/gh/hoshiizumiya/images/TaskScheduler.png)。
- 构造传给 `schtasks.exe` 的参数字符串：
  - 关键行：
  - string arguments = $"/Create /TN \"{TaskName}\" /TR \"\\\"{exePath}\\\"\" /SC ONLOGON /RL {runLevel} /F";
  - 解释：外层 /TR "..." 需要包含一个字符串；如果 exePath 自身包含空格（如 C:\Program Files\...），必须在 /TR 的值内部为路径再加一对引号。这里用 \"\\\"{exePath}\\\"\" 来产生最终的 "/TR "\"C:\Program Files\...\Snap.Hutao.exe\""，保证任务计划器不会把路径按空格切分成 Program 和 arguments。