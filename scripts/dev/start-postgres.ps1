$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = Join-Path $projectRoot ".local-services\postgres\data"
$runDir = Join-Path $projectRoot ".local-services\postgres\run"
$logFile = Join-Path $runDir "postgres.log"
$pwFile = Join-Path $runDir "pwfile.txt"

New-Item -ItemType Directory -Force -Path $runDir | Out-Null
Set-Content -Path $pwFile -Value "outlethub123"

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  & (Join-Path $pgBin "initdb.exe") -D $dataDir -U outlethub -A scram-sha-256 --pwfile=$pwFile --encoding=UTF8 --locale=C
}

$statusOutput = & (Join-Path $pgBin "pg_ctl.exe") -D $dataDir status 2>&1
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin "pg_ctl.exe") -D $dataDir -l $logFile -o "-p 5433 -h 127.0.0.1" start | Out-Host
  Start-Sleep -Seconds 2
}

$env:PGPASSWORD = "outlethub123"
$databaseExists = & (Join-Path $pgBin "psql.exe") -h 127.0.0.1 -p 5433 -U outlethub -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'outlethub';" 2>$null
if ($databaseExists.Trim() -ne "1") {
  & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p 5433 -U outlethub outlethub
}
Write-Output "PostgreSQL ready on 127.0.0.1:5433"
