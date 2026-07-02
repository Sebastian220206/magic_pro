#!/usr/bin/env pwsh
# Magic Pro — Agent Session Launcher (PowerShell)
# Usage: .\scripts\start-agent-session.ps1 [agent-name]
# Example: .\scripts\start-agent-session.ps1 typescript-agent

param(
    [Parameter(Mandatory=$false)]
    [string]$Agent
)

if (-not $Agent) {
    Write-Host "Usage: .\scripts\start-agent-session.ps1 [agent-name]"
    Write-Host ""
    Write-Host "Available agents:"
    Write-Host "  orchestrator"
    Write-Host "  typescript-agent"
    Write-Host "  audio-engine-agent"
    Write-Host "  ui-state-agent"
    Write-Host "  db-backend-agent"
    Write-Host "  testing-agent"
    Write-Host "  performance-agent"
    Write-Host "  ux-onboarding-agent"
    Write-Host "  deploy-agent"
    exit 1
}

$ContextFile = "agents/$Agent/context.md"
$ScopeFile = "agents/$Agent/scope.md"

if (-not (Test-Path $ContextFile)) {
    Write-Host "Error: $ContextFile not found"
    exit 1
}

Write-Host "========================================"
Write-Host "Starting Magic Pro Agent Session"
Write-Host "Agent: $Agent"
Write-Host "========================================"
Write-Host ""
Write-Host "Current audit score:"
Select-String -Path "agents/orchestrator/audit-score.md" -Pattern "Current Score" | ForEach-Object { $_.Line }
Write-Host ""
Write-Host "Today's tasks:"
Write-Host "  (see agents/orchestrator/daily-log.md)"
Write-Host ""
Write-Host "Agent scope:"
Get-Content $ScopeFile
Write-Host ""
Write-Host "========================================"
Write-Host "Loading MCP servers and starting opencode..."
Write-Host "========================================"

# Load MCP env vars if available
if (Test-Path ".env.mcp") {
    Get-Content ".env.mcp" | Where-Object { $_ -match "^\w+=" } | ForEach-Object {
        $parts = $_ -split "=", 2
        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
    }
}

# Start opencode with agent context (if opencode is in PATH)
opencode --context $ContextFile
