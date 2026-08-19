param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [ValidateRange(256, 2048)]
  [int]$TargetWidth = 1024
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
    [int]$Width
  )

  Ensure-ParentDirectory -Path $DestinationPath

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $scale = $Width / [double]$source.Width
    $targetHeight = [int][Math]::Round($source.Height * $scale)

    $bitmap = New-Object System.Drawing.Bitmap $Width, $targetHeight
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
        $graphics.DrawImage($source, 0, 0, $Width, $targetHeight)
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
    Source = "public/images/main-logo1.png"
    Destination = "public/images/main-logo1.optimized.png"
  },
  @{
    Source = "public/images/main-logo2.png"
    Destination = "public/images/main-logo2.optimized.png"
  },
  @{
    Source = "public/images/main-logo3.png"
    Destination = "asset-sources/public/images/main-logo3.optimized.png"
  }
)

$results = @()

foreach ($target in $targets) {
  $sourcePath = Resolve-SourceAssetPath -ProjectRootPath $ProjectRoot -RelativePath $target.Source
  $destinationPath = Join-Path $ProjectRoot $target.Destination

  if (-not (Test-Path $sourcePath)) {
    throw "Source asset not found: $($target.Source)"
  }

  Save-ResizedPng -SourcePath $sourcePath -DestinationPath $destinationPath -Width $TargetWidth

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
