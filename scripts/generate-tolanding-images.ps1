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

function Resolve-SourceDirectory {
  param([string]$ProjectRootPath)

  $archivedDir = Join-Path $ProjectRootPath "asset-sources/public/images/tolanding"
  $publicDir = Join-Path $ProjectRootPath "public/images/tolanding"

  if (Test-Path $archivedDir) {
    $archivedFiles = Get-ChildItem $archivedDir -File -Filter "*.png" | Sort-Object Name
    if ($archivedFiles.Count -ge 5) {
      return $archivedDir
    }
  }

  return $publicDir
}

function Get-ProjectRelativeLabel {
  param(
    [string]$ProjectRootPath,
    [string]$AbsolutePath
  )

  $relativePath = $AbsolutePath.Substring($ProjectRootPath.Length).TrimStart('\', '/')
  return $relativePath.Replace('\', '/')
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

$sourceDirectory = Resolve-SourceDirectory -ProjectRootPath $ProjectRoot
$sourceFiles = Get-ChildItem $sourceDirectory -File -Filter "*.png" |
  Sort-Object Name

if ($sourceFiles.Count -lt 5) {
  throw "Expected at least 5 PNG files in the tolanding source directory."
}

$targets = @(
  @{
    SourcePath = $sourceFiles[0].FullName
    SourceLabel = Get-ProjectRelativeLabel -ProjectRootPath $ProjectRoot -AbsolutePath $sourceFiles[0].FullName
    Destination = "public/images/tolanding/landing-preview-1.optimized.jpg"
  },
  @{
    SourcePath = $sourceFiles[1].FullName
    SourceLabel = Get-ProjectRelativeLabel -ProjectRootPath $ProjectRoot -AbsolutePath $sourceFiles[1].FullName
    Destination = "public/images/tolanding/landing-preview-2.optimized.jpg"
  },
  @{
    SourcePath = $sourceFiles[2].FullName
    SourceLabel = Get-ProjectRelativeLabel -ProjectRootPath $ProjectRoot -AbsolutePath $sourceFiles[2].FullName
    Destination = "public/images/tolanding/landing-preview-3.optimized.jpg"
  },
  @{
    SourcePath = $sourceFiles[3].FullName
    SourceLabel = Get-ProjectRelativeLabel -ProjectRootPath $ProjectRoot -AbsolutePath $sourceFiles[3].FullName
    Destination = "public/images/tolanding/landing-preview-4.optimized.jpg"
  },
  @{
    SourcePath = $sourceFiles[4].FullName
    SourceLabel = Get-ProjectRelativeLabel -ProjectRootPath $ProjectRoot -AbsolutePath $sourceFiles[4].FullName
    Destination = "public/images/tolanding/landing-preview-5.optimized.jpg"
  }
)

$results = @()

foreach ($target in $targets) {
  $sourcePath = $target.SourcePath
  $destinationPath = Join-Path $ProjectRoot $target.Destination

  if (-not (Test-Path $sourcePath)) {
    throw "Source asset not found: $($target.SourceLabel)"
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
    Source = $target.SourceLabel
    Destination = $target.Destination
    SourceKB = [Math]::Round($sourceInfo.Length / 1KB, 1)
    DestinationKB = [Math]::Round($destinationInfo.Length / 1KB, 1)
    SavingPercent = $savingPercent
  }
}

$results | Format-Table -AutoSize
