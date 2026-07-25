$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$redisRoot = Join-Path $projectRoot ".local-services\redis"
$redisExe = Join-Path $redisRoot "bin\Redis-8.2.2-Windows-x64-msys2\redis-server.exe"
$configPath = Join-Path $redisRoot "redis.conf"
$configMsysPath = "/cygdrive/" + $configPath.Substring(0, 1).ToLower() + $configPath.Substring(2).Replace("\", "/")

if (-not (Test-Path $redisExe)) {
  throw "redis-server.exe was not found under .local-services\redis."
}

$portCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -WarningAction SilentlyContinue
if (-not $portCheck.TcpTestSucceeded) {
  Start-Process -FilePath $redisExe -ArgumentList $configMsysPath -WorkingDirectory (Split-Path $redisExe) -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 2
}

$portCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -WarningAction SilentlyContinue
if (-not $portCheck.TcpTestSucceeded) {
  throw "Redis failed to start on 127.0.0.1:6379."
}

Write-Output "Redis ready on 127.0.0.1:6379"
