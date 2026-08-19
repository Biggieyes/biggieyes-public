param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [ValidateRange(1, 100)]
  [int]$Quality = 78
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } |
  Select-Object -First 1

if (-not $jpegEncoder) {
  throw "JPEG encoder not available."
}

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

function Save-OptimizedJpeg {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$JpegQuality
  )

  Ensure-ParentDirectory -Path $DestinationPath

  $source = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    $bitmap = New-Object System.Drawing.Bitmap $source.Width, $source.Height
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::FromArgb(23, 23, 23))
        $graphics.DrawImage($source, 0, 0, $source.Width, $source.Height)
      } finally {
        $graphics.Dispose()
      }

      $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
      $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality,
        [long]$JpegQuality
      )

      $bitmap.Save($DestinationPath, $jpegEncoder, $encoderParams)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$targets = @(
  @{
    Source = "public/images/bg-main2.png"
    Destination = "public/images/bg-main2.optimized.jpg"
  },
  @{
    Source = "public/images/blocks-bg2.png"
    Destination = "public/images/blocks-bg2.optimized.jpg"
  },
  @{
    Source = "public/images/panels/ecosystem.png"
    Destination = "public/images/panels/ecosystem.optimized.jpg"
  },
  @{
    Source = "public/images/panels/rewards.png"
    Destination = "public/images/panels/rewards.optimized.jpg"
  },
  @{
    Source = "public/images/panels/community.png"
    Destination = "public/images/panels/community.optimized.jpg"
  },
  @{
    Source = "public/images/panels/loading panel.png"
    Destination = "public/images/panels/loading-panel.optimized.jpg"
  }
)

$results = @()

foreach ($target in $targets) {
  $sourcePath = Resolve-SourceAssetPath -ProjectRootPath $ProjectRoot -RelativePath $target.Source
  $destinationPath = Join-Path $ProjectRoot $target.Destination

  if (-not (Test-Path $sourcePath)) {
    throw "Source asset not found: $($target.Source)"
  }

  Save-OptimizedJpeg -SourcePath $sourcePath -DestinationPath $destinationPath -JpegQuality $Quality

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
