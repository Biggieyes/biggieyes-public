param(
  [string]$OutputPath = "public/images/schemas/collection-structure-schema.png"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Convert-HexToColor {
  param([string]$Hex)
  $value = $Hex.TrimStart("#")
  if ($value.Length -ne 6) {
    throw "Invalid color: $Hex"
  }
  $r = [Convert]::ToInt32($value.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($value.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($value.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Set-Alpha {
  param(
    [System.Drawing.Color]$Color,
    [int]$Alpha
  )
  return [System.Drawing.Color]::FromArgb($Alpha, $Color.R, $Color.G, $Color.B)
}

function New-RoundedRectPath {
  param(
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

$blocks = @(
  @{ Name = "ORANGE";  Base = 1;  NFTs = 10; Growth = "+5%";  C1 = "#ff8a00"; C2 = "#e67a00" },
  @{ Name = "BLACK";   Base = 2;  NFTs = 9;  Growth = "+10%"; C1 = "#1b1b1f"; C2 = "#08090c" },
  @{ Name = "WHITE";   Base = 3;  NFTs = 8;  Growth = "+15%"; C1 = "#f5f5f5"; C2 = "#d8d8d8" },
  @{ Name = "BROWN";   Base = 4;  NFTs = 7;  Growth = "+20%"; C1 = "#8b5a2b"; C2 = "#6f471f" },
  @{ Name = "BLUE";    Base = 5;  NFTs = 6;  Growth = "+25%"; C1 = "#1e90ff"; C2 = "#1467b5" },
  @{ Name = "GREEN";   Base = 6;  NFTs = 5;  Growth = "+30%"; C1 = "#00c777"; C2 = "#009e5f" },
  @{ Name = "VIOLET";  Base = 7;  NFTs = 4;  Growth = "+35%"; C1 = "#7a5cff"; C2 = "#5a44bf" },
  @{ Name = "RED";     Base = 8;  NFTs = 3;  Growth = "+40%"; C1 = "#ff3b3b"; C2 = "#c12929" },
  @{ Name = "PINK";    Base = 9;  NFTs = 2;  Growth = "+45%"; C1 = "#ff69b4"; C2 = "#cf4d90" },
  @{ Name = "RAINBOW"; Base = 10; NFTs = 1;  Growth = "+50%"; C1 = "#ffe800"; C2 = "#5ddcff" }
)
$backgroundBonuses = @(5, 10, 15, 20, 25, 30, 35, 40, 45, 50)
$backgrounds = @()
for ($i = 0; $i -lt $blocks.Count; $i++) {
  $backgrounds += @{
    Name = $blocks[$i].Name
    Bonus = $backgroundBonuses[$i]
    C1 = $blocks[$i].C1
    C2 = $blocks[$i].C2
  }
}

$width = 4200
$height = 1760
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$backgroundRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
$backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  $backgroundRect,
  ([System.Drawing.Color]::FromArgb(255, 12, 15, 24)),
  ([System.Drawing.Color]::FromArgb(255, 6, 8, 14)),
  90
)
$graphics.FillRectangle($backgroundBrush, 0, 0, $width, $height)

$titleFont = New-Object System.Drawing.Font("Segoe UI", 42, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", 19, [System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$nameFont = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$valueFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$smallFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)
$arrowFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$sectionFont = New-Object System.Drawing.Font("Segoe UI", 26, [System.Drawing.FontStyle]::Bold)
$formulaFont = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)

$goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 232, 120))
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 231, 239, 255))
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 156, 172, 204))
$arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 232, 0))
$cardFillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 18, 21, 32))
$panelFillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 16, 19, 30))
$bonusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 128, 255, 204))

$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 255, 232, 0), 2)
$thinPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, 255, 255, 255), 1)

$graphics.DrawString("BIGGI COLLECTION STRUCTURE", $titleFont, $goldBrush, 54, 36)
$graphics.DrawString(
  "PNG schema: rarity blocks plus background structure with mint bonus mapping.",
  $subtitleFont,
  $mutedBrush,
  58,
  108
)

$marginX = 48
$startY = 188
$cardWidth = 390
$cardHeight = 930
$gap = 14

for ($i = 0; $i -lt $blocks.Count; $i++) {
  $block = $blocks[$i]
  $x = $marginX + ($i * ($cardWidth + $gap))
  $y = $startY
  $nextBlockName = if ($i -lt $blocks.Count - 1) { $blocks[($i + 1)].Name } else { "FINAL TIER" }
  $colorA = Convert-HexToColor $block.C1
  $colorB = Convert-HexToColor $block.C2

  $cardPath = New-RoundedRectPath -X $x -Y $y -Width $cardWidth -Height $cardHeight -Radius 22
  $graphics.FillPath($cardFillBrush, $cardPath)
  $graphics.DrawPath($borderPen, $cardPath)

  $bandRect = [System.Drawing.Rectangle]::new(($x + 12), ($y + 12), ($cardWidth - 24), 22)
  $bandBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bandRect,
    (Convert-HexToColor $block.C1),
    (Convert-HexToColor $block.C2),
    0
  )
  $graphics.FillRectangle($bandBrush, $bandRect)
  $graphics.DrawRectangle($thinPen, $bandRect)

  $rarityText = "RARITY {0:D2}" -f ($i + 1)
  $graphics.DrawString($rarityText, $labelFont, $mutedBrush, $x + 16, $y + 48)
  $nameColor = if ($block.Name -eq "WHITE") {
    [System.Drawing.Color]::FromArgb(255, 34, 38, 52)
  } else {
    [System.Drawing.Color]::FromArgb(255, 246, 250, 255)
  }
  $nameBrush = [System.Drawing.SolidBrush]::new($nameColor)
  $graphics.DrawString($block.Name, $nameFont, $nameBrush, $x + 16, $y + 74)

  $metricTop = $y + 140
  $metricHeight = 166
  $metricGap = 14

  $metrics = @(
    @{ Label = "BASE PRICE"; Value = "$($block.Base) POL" },
    @{ Label = "NFT COUNT"; Value = "$($block.NFTs)" },
    @{ Label = "LINKED BLOCK"; Value = $nextBlockName },
    @{ Label = "PRICE GROWTH"; Value = $block.Growth }
  )

  for ($m = 0; $m -lt $metrics.Count; $m++) {
    $my = $metricTop + ($m * ($metricHeight + $metricGap))
    $metricRect = [System.Drawing.Rectangle]::new(($x + 14), $my, ($cardWidth - 28), $metricHeight)
    $metricBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
      $metricRect,
      (Set-Alpha -Color $colorA -Alpha 92),
      (Set-Alpha -Color $colorB -Alpha 68),
      90
    )
    $metricPath = New-RoundedRectPath -X ($x + 14) -Y $my -Width ($cardWidth - 28) -Height $metricHeight -Radius 14
    $graphics.FillPath($metricBrush, $metricPath)
    $graphics.DrawPath($thinPen, $metricPath)
    $graphics.DrawString($metrics[$m].Label, $labelFont, $mutedBrush, $x + 28, $my + 22)
    $valueBrush = if ($metrics[$m].Label -eq "PRICE GROWTH") {
      [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 120, 255, 200))
    } else {
      $textBrush
    }
    $graphics.DrawString($metrics[$m].Value, $valueFont, $valueBrush, $x + 28, $my + 74)
    if ($metrics[$m].Label -eq "PRICE GROWTH") {
      $valueBrush.Dispose()
    }
    $metricBrush.Dispose()
    $metricPath.Dispose()
  }

  $graphics.DrawString("Block order follows rarity and base price progression.", $smallFont, $mutedBrush, $x + 16, $y + $cardHeight - 44)

  if ($i -lt $blocks.Count - 1) {
    $graphics.DrawString("->", $arrowFont, $arrowBrush, $x + $cardWidth + 1, $y + 18)
  }

  $bandBrush.Dispose()
  $nameBrush.Dispose()
  $cardPath.Dispose()
}

$bgPanelX = 48
$bgPanelY = 1160
$bgPanelWidth = $width - 96
$bgPanelHeight = 520
$bgPanelPath = New-RoundedRectPath -X $bgPanelX -Y $bgPanelY -Width $bgPanelWidth -Height $bgPanelHeight -Radius 22
$graphics.FillPath($panelFillBrush, $bgPanelPath)
$graphics.DrawPath($borderPen, $bgPanelPath)

$graphics.DrawString("BACKGROUND STRUCTURE", $sectionFont, $goldBrush, $bgPanelX + 20, $bgPanelY + 18)
$graphics.DrawString(
  "Each background adds a fixed bonus percent to the selected block price.",
  $subtitleFont,
  $mutedBrush,
  $bgPanelX + 22,
  $bgPanelY + 62
)

$formulaPath = New-RoundedRectPath -X ($bgPanelX + 22) -Y ($bgPanelY + 102) -Width ($bgPanelWidth - 44) -Height 72 -Radius 14
$formulaRect = [System.Drawing.Rectangle]::new(($bgPanelX + 22), ($bgPanelY + 102), ($bgPanelWidth - 44), 72)
$formulaBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  $formulaRect,
  ([System.Drawing.Color]::FromArgb(120, 31, 144, 255)),
  ([System.Drawing.Color]::FromArgb(105, 0, 199, 119)),
  0
)
$graphics.FillPath($formulaBrush, $formulaPath)
$graphics.DrawPath($thinPen, $formulaPath)
$graphics.DrawString(
  "Final Mint Price = Block Price + (Block Price x Background Bonus%)",
  $formulaFont,
  $textBrush,
  $bgPanelX + 38,
  $bgPanelY + 126
)
$formulaBrush.Dispose()
$formulaPath.Dispose()

$bgCardY = $bgPanelY + 196
$bgCardWidth = 390
$bgCardHeight = 286
$bgGap = 14

for ($i = 0; $i -lt $backgrounds.Count; $i++) {
  $bg = $backgrounds[$i]
  $bx = $marginX + ($i * ($bgCardWidth + $bgGap))

  $bgCardPath = New-RoundedRectPath -X $bx -Y $bgCardY -Width $bgCardWidth -Height $bgCardHeight -Radius 18
  $graphics.FillPath($cardFillBrush, $bgCardPath)
  $graphics.DrawPath($borderPen, $bgCardPath)

  $bgBandRect = [System.Drawing.Rectangle]::new(($bx + 12), ($bgCardY + 12), ($bgCardWidth - 24), 18)
  $bgBandBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bgBandRect,
    (Convert-HexToColor $bg.C1),
    (Convert-HexToColor $bg.C2),
    0
  )
  $graphics.FillRectangle($bgBandBrush, $bgBandRect)
  $graphics.DrawRectangle($thinPen, $bgBandRect)

  $bgLabel = "BG {0:D2}" -f ($i + 1)
  $graphics.DrawString($bgLabel, $labelFont, $mutedBrush, $bx + 16, $bgCardY + 42)
  $bgNameBrush = if ($bg.Name -eq "WHITE") {
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 40, 44, 58))
  } else {
    $textBrush
  }
  $graphics.DrawString($bg.Name, $nameFont, $bgNameBrush, $bx + 16, $bgCardY + 62)

  $bonusText = "+{0}% bonus" -f $bg.Bonus
  $graphics.DrawString("MINT BONUS", $labelFont, $mutedBrush, $bx + 16, $bgCardY + 114)
  $graphics.DrawString($bonusText, $valueFont, $bonusBrush, $bx + 16, $bgCardY + 142)

  $graphics.DrawString("Linked with same-index block tier.", $smallFont, $mutedBrush, $bx + 16, $bgCardY + 196)
  $graphics.DrawString("Applied in Collection 2 mint flow.", $smallFont, $mutedBrush, $bx + 16, $bgCardY + 216)

  if ($i -lt $backgrounds.Count - 1) {
    $graphics.DrawString("->", $arrowFont, $arrowBrush, $bx + $bgCardWidth + 1, $bgCardY + 12)
  }

  if ($bg.Name -eq "WHITE") {
    $bgNameBrush.Dispose()
  }
  $bgBandBrush.Dispose()
  $bgCardPath.Dispose()
}

$bgPanelPath.Dispose()

$footerRect = [System.Drawing.Rectangle]::new(52, ($height - 56), ($width - 104), 2)
$footerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 93, 220, 255), 2)
$graphics.DrawLine($footerPen, $footerRect.Left, $footerRect.Top, $footerRect.Right, $footerRect.Top)
$graphics.DrawString("Generated schema PNG for Collection panel preview", $smallFont, $mutedBrush, 58, $height - 42)

$outFile = [System.IO.Path]::GetFullPath($OutputPath)
$outDir = [System.IO.Path]::GetDirectoryName($outFile)
if (-not [System.IO.Directory]::Exists($outDir)) {
  [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
}

$bitmap.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

$footerPen.Dispose()
$borderPen.Dispose()
$thinPen.Dispose()
$backgroundBrush.Dispose()
$goldBrush.Dispose()
$textBrush.Dispose()
$mutedBrush.Dispose()
$arrowBrush.Dispose()
$cardFillBrush.Dispose()
$panelFillBrush.Dispose()
$bonusBrush.Dispose()

$titleFont.Dispose()
$subtitleFont.Dispose()
$labelFont.Dispose()
$nameFont.Dispose()
$valueFont.Dispose()
$smallFont.Dispose()
$arrowFont.Dispose()
$sectionFont.Dispose()
$formulaFont.Dispose()

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated $outFile"
