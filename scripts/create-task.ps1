# Run this script as Administrator (right-click → "Run with PowerShell" or from elevated terminal)
$action = New-ScheduledTaskAction `
    -Execute "C:\Program Files\nodejs\npm.cmd" `
    -Argument "run sync:full" `
    -WorkingDirectory "C:\Users\Ecosistemas\Desktop\Control de vacaciones"

$trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday `
    -At "00:00"

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName "SyncVacaciones" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Sincroniza empleados del ERP y crea cuentas auth para nuevos empleados (Control de Vacaciones)" `
    -RunLevel Highest `
    -Force

Write-Host "Tarea SyncVacaciones creada correctamente." -ForegroundColor Green
