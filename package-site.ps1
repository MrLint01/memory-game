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
  ".firebaserc",
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
  "Jira.csv",
  "404.html",
  "app.js",
  "endless-mode.js",
  "tutorial-mode.js",
  "stages-data-old.js",
  "stages-instructions-old.js"
)

$excludePatterns = @(
  "*.zip",
  "*.csv",
  "*.txt",
  "*.ps1"
)

$allowedTransparentSlothFiles = @(
  "jump_scare.png",
  "turbo_angel.png",
  "turbo_catching_branch.png",
  "turbo_climbing_splash.png",
  "turbo_flag_splash.png",
  "turbo_hanging_happy_splash.png",
  "turbo_holding_branch.png",
  "turbo_napping_on_log_splash.png",
  "turbo_painting.png",
  "turbo_tired_splash.png",
  "turbo_waving.png"
)

function Test-ShouldExcludeRelativePath {
  param(
    [string]$RelativePath
  )

  $normalized = ($RelativePath -replace '\\', '/').ToLowerInvariant()
  $fileName = [System.IO.Path]::GetFileName($normalized)

  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $true
  }

  if ($fileName.StartsWith(".")) {
    return $true
  }

  if ($normalized.StartsWith("imgs/sloths/") -and -not $normalized.StartsWith("imgs/sloths/transparent/")) {
    return $true
  }

  if ($normalized.StartsWith("imgs/sloths/transparent/")) {
    return ($allowedTransparentSlothFiles -notcontains $fileName)
  }

  if ($normalized -in @(
    "audio/regular-level-music-1.wav",
    "audio/wrong.wav",
    "imgs/home_button.clip",
    "imgs/fruits.clip",
    "imgs/chains.clip",
    "imgs/skip.png",
    "imgs/turbo.png",
    "imgs/the_red_penguin_resist.webp"
  )) {
    return $true
  }

  return $false
}

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
        $relativePath = $_.FullName.Substring($projectRootPrefix.Length)
        (
          -not $_.Name.StartsWith(".") -and
          $_.FullName -notmatch '[\\/]\.' -and
          -not (Test-ShouldExcludeRelativePath $relativePath)
        )
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
