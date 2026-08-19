param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-ParentDirectory {
  param([string]$Path)

  $parent = Split-Path -Parent $Path
  if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

$targets = @(
  @{
    Source = "public/images/mint.optimized.png"
    Destination = "public/images/mint.fallback.png"
  },
  @{
    Source = "public/images/claim.optimized.png"
    Destination = "public/images/claim.fallback.png"
  },
  @{
    Source = "public/images/redeem-button.optimized.png"
    Destination = "public/images/redeem-button.fallback.png"
  },
  @{
    Source = "public/images/main-logo1.optimized.png"
    Destination = "public/images/main-logo1.fallback.png"
  },
  @{
    Source = "public/images/main-logo2.optimized.png"
    Destination = "public/images/main-logo2.fallback.png"
  },
  @{
    Source = "public/images/icons/info.optimized.png"
    Destination = "public/images/icons/info.fallback.png"
  },
  @{
    Source = "public/images/icons/rewards.optimized.png"
    Destination = "public/images/icons/rewards.fallback.png"
  },
  @{
    Source = "public/images/icons/collection.optimized.png"
    Destination = "public/images/icons/collection.fallback.png"
  },
  @{
    Source = "public/images/icons/mint.optimized.png"
    Destination = "public/images/icons/mint.fallback.png"
  },
  @{
    Source = "public/images/icons/token.optimized.png"
    Destination = "public/images/icons/token.fallback.png"
  },
  @{
    Source = "public/images/icons/users.optimized.png"
    Destination = "public/images/icons/users.fallback.png"
  },
  @{
    Source = "public/images/icons/expansion.optimized.png"
    Destination = "public/images/icons/expansion.fallback.png"
  }
)

$results = @()

foreach ($target in $targets) {
  $sourcePath = Join-Path $ProjectRoot $target.Source
  $destinationPath = Join-Path $ProjectRoot $target.Destination

  if (-not (Test-Path $sourcePath)) {
    throw "Source asset not found: $($target.Source)"
  }

  Ensure-ParentDirectory -Path $destinationPath
  Copy-Item -Path $sourcePath -Destination $destinationPath -Force

  $sourceInfo = Get-Item $sourcePath
  $destinationInfo = Get-Item $destinationPath

  $results += [pscustomobject]@{
    Source = $target.Source
    Destination = $target.Destination
    SizeKB = [Math]::Round($destinationInfo.Length / 1KB, 1)
  }
}

$results | Format-Table -AutoSize
