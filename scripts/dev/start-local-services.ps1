$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

& (Join-Path $projectRoot "scripts\dev\start-postgres.ps1")
& (Join-Path $projectRoot "scripts\dev\start-redis.ps1")

Write-Output "Local PostgreSQL and Redis are ready."
