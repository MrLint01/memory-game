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
  "prepared_data",
  "prepared_data_test",
  "prepared_data_tmp_gj",
  "scripts",
  "src",
  "tools",
  "serviceAccountKey.json",
  "firebase-debug.log",
  "firebase.json",
  "firestore.rules",
  "gamejolt.zip",
  "dist",
  ".package-staging",
  ".gitignore",
  "README.md",
  "DOCS.md",
  "package.json",
  "package-lock.json",
  "feedback.txt",
  "webpage.txt",
  "data_combined.json",
  "stage-idea-slop.txt",
  "Jira.csv"
)

$excludePatterns = @(
  "*.zip",
  "*.csv",
  "*.txt",
  "*.ps1"
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
  $item = $_
  ($excludeNames -notcontains $item.Name) -and -not ($excludePatterns | Where-Object { $item.Name -like $_ } | Select-Object -First 1)
}

$zip = [System.IO.Compression.ZipFile]::Open($resolvedOutput, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $projectRootPrefix = $projectRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  foreach ($item in $rootItems) {
    if ($item.PSIsContainer) {
      $files = Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force | Where-Object {
        -not $_.Name.StartsWith(".") -and $_.FullName -notmatch '[\\/]\.'
      }
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
