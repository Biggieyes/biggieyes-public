param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [ValidateRange(64, 1024)]
  [int]$Size = 320
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Ensure-ParentDirectory {
  param([string]$Path)
  $parent = Split-Path -Parent $Path
  if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

function Resolve-SourceAssetPath {
  param(
    [string]$ProjectRootPath,
    [string]$RelativePath
  )

  $archivedPath = Join-Path $ProjectRootPath (Join-Path "asset-sources" $RelativePath)
  if (Test-Path $archivedPath) {
    return $archivedPath
  }

  return (Join-Path $ProjectRootPath $RelativePath)
}

function Save-ResizedPng {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$TargetSize
  )

  Ensure-ParentDirectory -Path $DestinationPath

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $bitmap = New-Object System.Drawing.Bitmap $TargetSize, $TargetSize
    $bitmap.SetResolution($source.HorizontalResolution, $source.VerticalResolution)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $TargetSize, $TargetSize)
      } finally {
        $graphics.Dispose()
      }

      $bitmap.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$targets = @(
  @{
    Source = "public/images/mint.png"
    Destination = "public/images/mint.optimized.png"
  },
  @{
    Source = "public/images/redeem-button.png"
    Destination = "public/images/redeem-button.optimized.png"
  },
  @{
    Source = "public/images/claim.png"
    Destination = "public/images/claim.optimized.png"
  },
  @{
    Source = "public/images/icons/info.png"
    Destination = "public/images/icons/info.optimized.png"
  }
)

$results = @()

foreach ($target in $targets) {
  $sourcePath = Resolve-SourceAssetPath -ProjectRootPath $ProjectRoot -RelativePath $target.Source
  $destinationPath = Join-Path $ProjectRoot $target.Destination

  if (-not (Test-Path $sourcePath)) {
    throw "Source asset not found: $($target.Source)"
  }

  Save-ResizedPng -SourcePath $sourcePath -DestinationPath $destinationPath -TargetSize $Size

  $sourceInfo = Get-Item $sourcePath
  $destinationInfo = Get-Item $destinationPath
  $savingBytes = [Math]::Max(0, $sourceInfo.Length - $destinationInfo.Length)
  $savingPercent = if ($sourceInfo.Length -gt 0) {
    [Math]::Round(($savingBytes / $sourceInfo.Length) * 100, 1)
  } else {
    0
  }

  $results += [pscustomobject]@{
    Source = $target.Source
    Destination = $target.Destination
    SourceKB = [Math]::Round($sourceInfo.Length / 1KB, 1)
    DestinationKB = [Math]::Round($destinationInfo.Length / 1KB, 1)
    SavingPercent = $savingPercent
  }
}

$results | Format-Table -AutoSize
