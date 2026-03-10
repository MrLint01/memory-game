param(
  [string]$OutputPath = ".\dist\flash-recall.zip"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
$outputDir = Split-Path -Parent $resolvedOutput

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

if (!(Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

if (Test-Path $resolvedOutput) {
  Remove-Item $resolvedOutput -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$rootItems = Get-ChildItem -LiteralPath $projectRoot -Force | Where-Object {
  $excludeNames -notcontains $_.Name
}

$zip = [System.IO.Compression.ZipFile]::Open($resolvedOutput, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $projectRootPrefix = $projectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  foreach ($item in $rootItems) {
    if ($item.PSIsContainer) {
      $files = Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force
      foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($projectRootPrefix.Length)
        $entryName = ($relativePath -replace '\\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
          $zip,
          $file.FullName,
          $entryName,
          [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
      }
    } elseif ($item.PSIsContainer -eq $false) {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $item.FullName,
        $item.Name,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
} finally {
  $zip.Dispose()
}

Write-Host "Created package:" $resolvedOutput
