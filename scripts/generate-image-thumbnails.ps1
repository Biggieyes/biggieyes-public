param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [ValidateRange(1, 100)]
  [int]$Quality = 68
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

function Save-SquareThumbnail {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$Size,
    [int]$JpegQuality
  )

  Ensure-ParentDirectory -Path $DestinationPath

  $source = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Black)

        $srcWidth = [double]$source.Width
        $srcHeight = [double]$source.Height
        $scale = [Math]::Max($Size / $srcWidth, $Size / $srcHeight)
        $drawWidth = [int][Math]::Ceiling($srcWidth * $scale)
        $drawHeight = [int][Math]::Ceiling($srcHeight * $scale)
        $offsetX = [int][Math]::Floor(($Size - $drawWidth) / 2)
        $offsetY = [int][Math]::Floor(($Size - $drawHeight) / 2)

        $graphics.DrawImage($source, $offsetX, $offsetY, $drawWidth, $drawHeight)
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

function To-RelativePath {
  param(
    [string]$BasePath,
    [string]$FullPath
  )
  $relative = $FullPath.Substring($BasePath.Length).TrimStart("\", "/")
  return $relative
}

$blocksRoot = Join-Path $ProjectRoot "public/images/blocks"
$blocksThumbRoot = Join-Path $ProjectRoot "public/images/blocks-thumb"
$rewardsRoot = Join-Path $ProjectRoot "public/images/rewards"
$rewardsThumbRoot = Join-Path $ProjectRoot "public/images/rewards-thumb"

$generatedBlockCardThumbs = 0
$generatedBlockModalThumbs = 0
$generatedRewardThumbs = 0

# 1) One card thumbnail per block folder
$blockFolders = Get-ChildItem -Path $blocksRoot -Directory
foreach ($folder in $blockFolders) {
  $source = Get-ChildItem -Path $folder.FullName -File -Filter "*.png" |
    Sort-Object Name |
    Select-Object -First 1
  if (-not $source) { continue }

  $dest = Join-Path $folder.FullName "thumb.jpg"
  Save-SquareThumbnail -SourcePath $source.FullName -DestinationPath $dest -Size 220 -JpegQuality $Quality
  $generatedBlockCardThumbs++
}

# 2) Thumbnails for block modal previews
$blockSources = Get-ChildItem -Path $blocksRoot -Recurse -File -Filter "*.png"
foreach ($source in $blockSources) {
  $relative = To-RelativePath -BasePath $blocksRoot -FullPath $source.FullName
  $destRelative = [System.IO.Path]::ChangeExtension($relative, ".jpg")
  $dest = Join-Path $blocksThumbRoot $destRelative
  Save-SquareThumbnail -SourcePath $source.FullName -DestinationPath $dest -Size 160 -JpegQuality $Quality
  $generatedBlockModalThumbs++
}

# 3) Thumbnails for rewards strips/grids used in REWARDS panel
$rewardsSources = Get-ChildItem -Path $rewardsRoot -Recurse -File -Filter "*.png"
foreach ($source in $rewardsSources) {
  $relative = To-RelativePath -BasePath $rewardsRoot -FullPath $source.FullName
  $normalized = $relative.Replace("\", "/")
  if ($normalized -notmatch "^(block/page\d+/|orange/page\d+/|rainbow/|characters/|rainbowNFT/)") {
    continue
  }

  $destRelative = [System.IO.Path]::ChangeExtension($relative, ".jpg")
  $dest = Join-Path $rewardsThumbRoot $destRelative
  Save-SquareThumbnail -SourcePath $source.FullName -DestinationPath $dest -Size 80 -JpegQuality $Quality
  $generatedRewardThumbs++
}

Write-Host "Thumbnail generation completed."
Write-Host ("Block card thumbs:  {0}" -f $generatedBlockCardThumbs)
Write-Host ("Block modal thumbs: {0}" -f $generatedBlockModalThumbs)
Write-Host ("Reward thumbs:      {0}" -f $generatedRewardThumbs)
