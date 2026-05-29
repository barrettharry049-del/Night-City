$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$script = Join-Path $root "tools\Update-LiveData.ps1"
$taskName = "Rainline City Live Data"

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`"" `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).Date `
  -RepetitionInterval (New-TimeSpan -Minutes 10)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Refreshes Rainline City live-data.js every 10 minutes." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "Installed and started '$taskName'."
