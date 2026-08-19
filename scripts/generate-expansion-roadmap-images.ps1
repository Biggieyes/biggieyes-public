param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [ValidateRange(1, 100)]
  [int]$Quality = 84
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
        $graphics.Clear([System.Drawing.Color]::Black)
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
    Source = "public/images/expansion-roadmap/universe.png"
    Destination = "public/images/expansion-roadmap/universe.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/universe-public.png"
    Destination = "public/images/expansion-roadmap/universe-public.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/mutant.png"
    Destination = "public/images/expansion-roadmap/mutant.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/mutant-public.png"
    Destination = "public/images/expansion-roadmap/mutant-public.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/apocalipse.png"
    Destination = "public/images/expansion-roadmap/apocalipse.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/apocalipse-public.png"
    Destination = "public/images/expansion-roadmap/apocalipse-public.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/super-hero.png"
    Destination = "public/images/expansion-roadmap/super-hero.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/super-hero-public.png"
    Destination = "public/images/expansion-roadmap/super-hero-public.optimized.jpg"
  },
  @{
    Source = "public/images/expansion-roadmap/multiverse.png"
    Destination = "public/images/expansion-roadmap/multiverse.optimized.jpg"
  }
)

$results = @()

foreach ($target in $targets) {
  $sourcePath = Join-Path $ProjectRoot $target.Source
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
