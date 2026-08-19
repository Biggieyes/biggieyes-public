param(
  [string]$OutputPath = "public/images/schemas/rewards-flow-diagram.png"
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

function Draw-GradientCard {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$Radius,
    [string]$ColorA,
    [string]$ColorB,
    [string]$Title,
    [string[]]$Lines,
    [System.Drawing.Font]$TitleFont,
    [System.Drawing.Font]$TextFont,
    [System.Drawing.Brush]$TitleBrush,
    [System.Drawing.Brush]$TextBrush
  )

  $a = Convert-HexToColor $ColorA
  $b = Convert-HexToColor $ColorB
  $rect = [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height)
  $path = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
  $fillBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (Set-Alpha -Color $a -Alpha 205),
    (Set-Alpha -Color $b -Alpha 160),
    130
  )
  $borderPen = [System.Drawing.Pen]::new((Set-Alpha -Color $a -Alpha 235), 2)

  $Graphics.FillPath($fillBrush, $path)
  $Graphics.DrawPath($borderPen, $path)
  $Graphics.DrawString($Title, $TitleFont, $TitleBrush, $X + 18, $Y + 16)

  $lineY = $Y + 64
  foreach ($line in $Lines) {
    $Graphics.DrawString($line, $TextFont, $TextBrush, $X + 18, $lineY)
    $lineY += 34
  }

  $fillBrush.Dispose()
  $borderPen.Dispose()
  $path.Dispose()
}

function Draw-Arrow {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$X1,
    [int]$Y1,
    [int]$X2,
    [int]$Y2,
    [string]$ColorHex,
    [float]$Thickness,
    [bool]$Dashed,
    [string]$Label,
    [System.Drawing.Font]$LabelFont,
    [System.Drawing.Brush]$LabelBrush
  )

  $color = Convert-HexToColor $ColorHex
  $pen = [System.Drawing.Pen]::new((Set-Alpha -Color $color -Alpha 245), $Thickness)
  if ($Dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $cap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(8, 10, $true)
  $pen.CustomEndCap = $cap

  $Graphics.DrawLine($pen, $X1, $Y1, $X2, $Y2)

  if ($Label) {
    $lx = [int](($X1 + $X2) / 2 + 8)
    $ly = [int](($Y1 + $Y2) / 2 - 26)
    $Graphics.DrawString($Label, $LabelFont, $LabelBrush, $lx, $ly)
  }

  $cap.Dispose()
  $pen.Dispose()
}

$width = 3600
$height = 1980
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
$bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  $bgRect,
  ([System.Drawing.Color]::FromArgb(255, 7, 10, 20)),
  ([System.Drawing.Color]::FromArgb(255, 4, 6, 12)),
  90
)
$graphics.FillRectangle($bgBrush, $bgRect)

$titleFont = [System.Drawing.Font]::new("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$subTitleFont = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Regular)
$cardTitleFont = [System.Drawing.Font]::new("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$cardTextFont = [System.Drawing.Font]::new("Segoe UI", 16, [System.Drawing.FontStyle]::Regular)
$arrowLabelFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$legendFont = [System.Drawing.Font]::new("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$footerFont = [System.Drawing.Font]::new("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)

$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 232, 120))
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 226, 236, 255))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 145, 168, 204))
$tokenBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 131, 246, 196))
$nativeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 186, 102))
$nftBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 145, 214))

$graphics.DrawString("BIGGI REWARDS FLOW DIAGRAM", $titleFont, $titleBrush, 48, 34)
$graphics.DrawString(
  "Contract wiring and value flows for native POL, BIGGI token, and NFT rewards.",
  $subTitleFont,
  $mutedBrush,
  52,
  106
)

# Layer cards
Draw-GradientCard -Graphics $graphics -X 1130 -Y 120 -Width 1340 -Height 170 -Radius 22 `
  -ColorA "#23d5ab" -ColorB "#0f2f3c" `
  -Title "FRONTEND: REWARDS PANEL" `
  -Lines @("User actions: claim, refresh, explorer.", "Reads snapshots and sends signed claim tx.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 170 -Y 390 -Width 1030 -Height 200 -Radius 20 `
  -ColorA "#3fa9f5" -ColorB "#1d3d6a" `
  -Title "READER: TOKEN_REWARDS_READER" `
  -Lines @("Read-only stats for token pools.", "Claim preview units and remaining caps.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1285 -Y 390 -Width 1030 -Height 200 -Radius 20 `
  -ColorA "#3fa9f5" -ColorB "#1d3d6a" `
  -Title "READER: REWARDS_READER" `
  -Lines @("Aggregates reward contract addresses.", "Unified read layer for panel cards.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 2400 -Y 390 -Width 1030 -Height 200 -Radius 20 `
  -ColorA "#3fa9f5" -ColorB "#1d3d6a" `
  -Title "READER: NFT_REWARDS_READER" `
  -Lines @("NFT reward status snapshots.", "Rank claims and minted reward views.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 170 -Y 720 -Width 1030 -Height 250 -Radius 22 `
  -ColorA "#27d9d2" -ColorB "#113848" `
  -Title "CONTRACT: TOKEN_REWARDS" `
  -Lines @("Distributes BIGGI token claims.", "Claim() sends ERC20 payout to wallet.", "Tracks weekly reward units.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1285 -Y 720 -Width 1030 -Height 250 -Radius 22 `
  -ColorA "#ffb347" -ColorB "#5a3815" `
  -Title "CONTRACT: COLLECTION_REWARDS" `
  -Lines @("Holds native POL reward balances.", "Block / Orange / Rainbow claim rails.", "Transfers native payouts to wallet.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 2400 -Y 720 -Width 1030 -Height 250 -Radius 22 `
  -ColorA "#ff6ad5" -ColorB "#5a2148" `
  -Title "CONTRACT: NFT_REWARDS" `
  -Lines @("Manages NFT reward eligibility.", "Character / leaderboard / mystery flows.", "Mints or releases NFT rewards.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 170 -Y 1085 -Width 1030 -Height 220 -Radius 20 `
  -ColorA "#23d5ab" -ColorB "#0f2f3c" `
  -Title "ASSET: BIGGI TOKEN TREASURY" `
  -Lines @("ERC20 pool that funds token claims.", "Value flow: BIGGI -> TOKEN_REWARDS.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1285 -Y 1085 -Width 1030 -Height 220 -Radius 20 `
  -ColorA "#ffd166" -ColorB "#563612" `
  -Title "ASSET: NATIVE POL REWARD POOL" `
  -Lines @("Native balances for COLLECTION claims.", "Value flow: POL -> COLLECTION_REWARDS.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 2400 -Y 1085 -Width 1030 -Height 220 -Radius 20 `
  -ColorA "#d66bff" -ColorB "#4b1d64" `
  -Title "ASSET: NFT REWARD SET" `
  -Lines @("URIs and reward metadata source.", "Value flow: NFT set -> NFT_REWARDS.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 900 -Y 1450 -Width 1800 -Height 280 -Radius 24 `
  -ColorA "#4ac0ff" -ColorB "#203f7a" `
  -Title "WALLET / USER CLAIM OUTPUT" `
  -Lines @(
    "Receives BIGGI token claims from TOKEN_REWARDS.",
    "Receives native POL claims from COLLECTION_REWARDS.",
    "Receives NFT reward mints from NFT_REWARDS.",
    "Sends signed claim transactions back to reward contracts."
  ) `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

# Read arrows
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 290 -X2 685 -Y2 390 -ColorHex "#5ddcff" -Thickness 3.5 -Dashed $true `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 290 -X2 1800 -Y2 390 -ColorHex "#5ddcff" -Thickness 3.5 -Dashed $true `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 290 -X2 2915 -Y2 390 -ColorHex "#5ddcff" -Thickness 3.5 -Dashed $true `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush

Draw-Arrow -Graphics $graphics -X1 685 -Y1 590 -X2 685 -Y2 720 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 590 -X2 1800 -Y2 720 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush
Draw-Arrow -Graphics $graphics -X1 2915 -Y1 590 -X2 2915 -Y2 720 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush

# Write tx arrows
Draw-Arrow -Graphics $graphics -X1 1500 -Y1 1450 -X2 685 -Y2 970 -ColorHex "#f8f9ff" -Thickness 3 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 1450 -X2 1800 -Y2 970 -ColorHex "#f8f9ff" -Thickness 3 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush
Draw-Arrow -Graphics $graphics -X1 2100 -Y1 1450 -X2 2915 -Y2 970 -ColorHex "#f8f9ff" -Thickness 3 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $textBrush

# Asset in-flow arrows
Draw-Arrow -Graphics $graphics -X1 685 -Y1 1085 -X2 685 -Y2 970 -ColorHex "#27d9d2" -Thickness 4 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $tokenBrush
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 1085 -X2 1800 -Y2 970 -ColorHex "#ffb347" -Thickness 4 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $nativeBrush
Draw-Arrow -Graphics $graphics -X1 2915 -Y1 1085 -X2 2915 -Y2 970 -ColorHex "#ff6ad5" -Thickness 4 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $nftBrush

# Out-flow arrows to wallet
Draw-Arrow -Graphics $graphics -X1 685 -Y1 970 -X2 1180 -Y2 1450 -ColorHex "#27d9d2" -Thickness 4 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $tokenBrush
Draw-Arrow -Graphics $graphics -X1 1800 -Y1 970 -X2 1800 -Y2 1450 -ColorHex "#ffb347" -Thickness 4 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $nativeBrush
Draw-Arrow -Graphics $graphics -X1 2915 -Y1 970 -X2 2420 -Y2 1450 -ColorHex "#ff6ad5" -Thickness 4 -Dashed $false `
  -Label "" -LabelFont $arrowLabelFont -LabelBrush $nftBrush

# Legend
$legendY = 1782
$legendPenRead = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 93, 220, 255), 3)
$legendPenRead.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$graphics.DrawLine($legendPenRead, 70, $legendY + 8, 170, $legendY + 8)
$graphics.DrawString("Read path", $legendFont, $textBrush, 182, $legendY - 4)

$legendPenWrite = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 248, 249, 255), 3)
$graphics.DrawLine($legendPenWrite, 500, $legendY + 8, 600, $legendY + 8)
$graphics.DrawString("Signed claim tx", $legendFont, $textBrush, 612, $legendY - 4)

$legendPenToken = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 39, 217, 210), 4)
$graphics.DrawLine($legendPenToken, 1040, $legendY + 8, 1140, $legendY + 8)
$graphics.DrawString("BIGGI token flow", $legendFont, $tokenBrush, 1152, $legendY - 4)

$legendPenNative = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 179, 71), 4)
$graphics.DrawLine($legendPenNative, 1650, $legendY + 8, 1750, $legendY + 8)
$graphics.DrawString("Native POL flow", $legendFont, $nativeBrush, 1762, $legendY - 4)

$legendPenNft = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 106, 213), 4)
$graphics.DrawLine($legendPenNft, 2220, $legendY + 8, 2320, $legendY + 8)
$graphics.DrawString("NFT reward flow", $legendFont, $nftBrush, 2332, $legendY - 4)

$legendPenRead.Dispose()
$legendPenWrite.Dispose()
$legendPenToken.Dispose()
$legendPenNative.Dispose()
$legendPenNft.Dispose()

$footerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 93, 220, 255), 2)
$graphics.DrawLine($footerPen, 58, 1928, ($width - 58), 1928)
$graphics.DrawString("Generated rewards schema PNG for REWARDS panel", $footerFont, $mutedBrush, 64, 1940)
$footerPen.Dispose()

$outFile = [System.IO.Path]::GetFullPath($OutputPath)
$outDir = [System.IO.Path]::GetDirectoryName($outFile)
if (-not [System.IO.Directory]::Exists($outDir)) {
  [System.IO.Directory]::CreateDirectory($outDir) | Out-Null
}

$bitmap.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)

$bgBrush.Dispose()
$titleBrush.Dispose()
$textBrush.Dispose()
$mutedBrush.Dispose()
$tokenBrush.Dispose()
$nativeBrush.Dispose()
$nftBrush.Dispose()

$titleFont.Dispose()
$subTitleFont.Dispose()
$cardTitleFont.Dispose()
$cardTextFont.Dispose()
$arrowLabelFont.Dispose()
$legendFont.Dispose()
$footerFont.Dispose()

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated $outFile"
