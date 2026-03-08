param(
  [string]$OutputPath = ".\dist\flash-recall.zip"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
$outputDir = Split-Path -Parent $resolvedOutput
$stagingDir = Join-Path $projectRoot ".package-staging"

$excludeNames = @(
  ".git",
  ".github",
  ".firebase",
  ".venv",
  "analysis_output",
  "dataconnect",
  "node_modules",
  "prepared_data_tmp_gj",
  "serviceAccountKey.json",
  "firebase-debug.log",
  "gamejolt.zip",
  "dist",
  ".package-staging"
)

if (Test-Path $stagingDir) {
  Remove-Item $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Get-ChildItem -LiteralPath $projectRoot -Force | Where-Object {
  $excludeNames -notcontains $_.Name
} | ForEach-Object {
  $destination = Join-Path $stagingDir $_.Name
  Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
}

if (!(Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

if (Test-Path $resolvedOutput) {
  Remove-Item $resolvedOutput -Force
}

Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $resolvedOutput -CompressionLevel Optimal
Remove-Item $stagingDir -Recurse -Force

Write-Host "Created package:" $resolvedOutput
