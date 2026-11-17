$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path '.env')) { pnpm env:init; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
pnpm db:up
if ($LASTEXITCODE) { throw 'Docker/PostgreSQL unavailable. Start Docker Desktop; restart Windows if requested.' }
pnpm db:generate
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm db:check
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm dev
