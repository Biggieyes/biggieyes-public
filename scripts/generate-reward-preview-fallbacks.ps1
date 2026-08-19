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

function Get-ProjectRelativeLabel {
  param(
    [string]$ProjectRootPath,
    [string]$AbsolutePath
  )

  $relativePath = $AbsolutePath.Substring($ProjectRootPath.Length).TrimStart('\', '/')
  return $relativePath.Replace('\', '/')
}

function Resolve-SourceDirectory {
  param(
    [string]$ProjectRootPath,
    [string]$RelativeFolder
  )

  $archivedDir = Join-Path $ProjectRootPath ("asset-sources/public/images/rewards/{0}" -f $RelativeFolder)
  $publicDir = Join-Path $ProjectRootPath ("public/images/rewards/{0}" -f $RelativeFolder)

  if (Test-Path $archivedDir) {
    $archivedFiles = Get-ChildItem $archivedDir -File -Filter "*.png"
    if ($archivedFiles.Count -gt 0) {
      return $archivedDir
    }
  }

  return $publicDir
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

$sourceFolders = @(
  "characters",
  "rainbowNFT"
)

$results = @()

foreach ($folder in $sourceFolders) {
  $sourceDirectory = Resolve-SourceDirectory -ProjectRootPath $ProjectRoot -RelativeFolder $folder
  $sourceFiles = Get-ChildItem $sourceDirectory -File -Filter "*.png" | Sort-Object Name

  if ($sourceFiles.Count -eq 0) {
    throw "Expected at least one PNG file in the rewards source directory: $folder"
  }

  foreach ($sourceFile in $sourceFiles) {
    $destinationRelativePath = "public/images/rewards/{0}/{1}.optimized.jpg" -f $folder, $sourceFile.BaseName
    $destinationPath = Join-Path $ProjectRoot $destinationRelativePath

    Save-OptimizedJpeg -SourcePath $sourceFile.FullName -DestinationPath $destinationPath -JpegQuality $Quality

    $destinationInfo = Get-Item $destinationPath
    $savingBytes = [Math]::Max(0, $sourceFile.Length - $destinationInfo.Length)
    $savingPercent = if ($sourceFile.Length -gt 0) {
      [Math]::Round(($savingBytes / $sourceFile.Length) * 100, 1)
    } else {
      0
    }

    $results += [pscustomobject]@{
      Source = Get-ProjectRelativeLabel -ProjectRootPath $ProjectRoot -AbsolutePath $sourceFile.FullName
      Destination = $destinationRelativePath
      SourceKB = [Math]::Round($sourceFile.Length / 1KB, 1)
      DestinationKB = [Math]::Round($destinationInfo.Length / 1KB, 1)
      SavingPercent = $savingPercent
    }
  }
}

$results | Format-Table -AutoSize
