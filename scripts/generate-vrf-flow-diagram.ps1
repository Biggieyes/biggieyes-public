param(
  [string]$OutputPath = "public/images/schemas/vrf-flow-diagram.png"
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
    (Set-Alpha -Color $a -Alpha 208),
    (Set-Alpha -Color $b -Alpha 165),
    132
  )
  $borderPen = [System.Drawing.Pen]::new((Set-Alpha -Color $a -Alpha 236), 2)

  $Graphics.FillPath($fillBrush, $path)
  $Graphics.DrawPath($borderPen, $path)
  $Graphics.DrawString($Title, $TitleFont, $TitleBrush, $X + 18, $Y + 14)

  $lineY = $Y + 62
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
    [bool]$Dashed
  )

  $color = Convert-HexToColor $ColorHex
  $pen = [System.Drawing.Pen]::new((Set-Alpha -Color $color -Alpha 246), $Thickness)
  if ($Dashed) {
    $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  }
  $cap = [System.Drawing.Drawing2D.AdjustableArrowCap]::new(8, 10, $true)
  $pen.CustomEndCap = $cap
  $Graphics.DrawLine($pen, $X1, $Y1, $X2, $Y2)
  $cap.Dispose()
  $pen.Dispose()
}

$width = 3840
$height = 2160
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bgRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
$bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  $bgRect,
  ([System.Drawing.Color]::FromArgb(255, 6, 10, 20)),
  ([System.Drawing.Color]::FromArgb(255, 3, 6, 13)),
  90
)
$graphics.FillRectangle($bgBrush, $bgRect)

$titleFont = [System.Drawing.Font]::new("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$subTitleFont = [System.Drawing.Font]::new("Segoe UI", 19, [System.Drawing.FontStyle]::Regular)
$cardTitleFont = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$cardTextFont = [System.Drawing.Font]::new("Segoe UI", 15, [System.Drawing.FontStyle]::Regular)
$legendFont = [System.Drawing.Font]::new("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$footerFont = [System.Drawing.Font]::new("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)

$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 232, 120))
$textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 230, 238, 255))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 144, 168, 204))
$readBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 93, 220, 255))
$signedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 248, 249, 255))
$requestBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 155, 123, 255))
$callbackBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 107, 238, 91))
$eventBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 39, 217, 210))

$graphics.DrawString("BIGGI VRF FLOW DIAGRAM", $titleFont, $titleBrush, 48, 34)
$graphics.DrawString(
  "VRF panel sections, request lifecycle, and Chainlink callback/read paths.",
  $subTitleFont,
  $mutedBrush,
  52,
  108
)

# Frontend panel
Draw-GradientCard -Graphics $graphics -X 1180 -Y 120 -Width 1480 -Height 170 -Radius 22 `
  -ColorA "#23d5ab" -ColorB "#0f2f3c" `
  -Title "FRONTEND: VRF PANEL" `
  -Lines @("Actions: Redeem/Request, Refresh, Explorer, Cancel pending.", "Tabs read one shared VRF snapshot state.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

# Section cards
Draw-GradientCard -Graphics $graphics -X 100 -Y 360 -Width 700 -Height 190 -Radius 20 `
  -ColorA "#4aa5ff" -ColorB "#1e3c74" `
  -Title "SECTION: REQUESTS" `
  -Lines @("Last request status + random words.", "Fast shortcuts to tx explorer.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 835 -Y 360 -Width 700 -Height 190 -Radius 20 `
  -ColorA "#3f8dff" -ColorB "#2a367a" `
  -Title "SECTION: HISTORY" `
  -Lines @("Loaded request rows and confirmations.", "Wallet-focused VRF archive view.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1570 -Y 360 -Width 700 -Height 190 -Radius 20 `
  -ColorA "#27d9d2" -ColorB "#154f66" `
  -Title "SECTION: POST-REDEEM" `
  -Lines @("Request -> fulfillment -> proof checks.", "Read-only orchestration states.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 2305 -Y 360 -Width 700 -Height 190 -Radius 20 `
  -ColorA "#9b7bff" -ColorB "#41317a" `
  -Title "SECTION: CRE ENGINE" `
  -Lines @("Queue and proof completeness signals.", "Read-only runtime diagnostics.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 3040 -Y 360 -Width 700 -Height 190 -Radius 20 `
  -ColorA "#ff6ad5" -ColorB "#5a2148" `
  -Title "SECTION: PROOF LOG" `
  -Lines @("Audit checks per request row.", "Warns on missing tx or words.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

# Shared view model
Draw-GradientCard -Graphics $graphics -X 920 -Y 640 -Width 2000 -Height 220 -Radius 22 `
  -ColorA "#ffd166" -ColorB "#5b3a14" `
  -Title "SHARED VRF VIEW MODEL (useVRF + panel state)" `
  -Lines @("Single source for last request, history rows, params, and proof checks.", "All tabs read from this normalized snapshot.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

# Contract / infra row
Draw-GradientCard -Graphics $graphics -X 110 -Y 940 -Width 860 -Height 230 -Radius 22 `
  -ColorA "#4ac0ff" -ColorB "#203f7a" `
  -Title "WALLET / USER" `
  -Lines @("Signs redeem/request tx.", "Receives tx hash and claim state feedback.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1020 -Y 940 -Width 860 -Height 230 -Radius 22 `
  -ColorA "#27d9d2" -ColorB "#113848" `
  -Title "CONTRACT: BIGGIEYESMAIN" `
  -Lines @("Creates VRF requestId for redeem flow.", "Stores request status and fulfillment outputs.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1930 -Y 940 -Width 860 -Height 230 -Radius 22 `
  -ColorA "#9b7bff" -ColorB "#3f2c72" `
  -Title "CHAINLINK VRF COORDINATOR" `
  -Lines @("Accepts randomness request.", "Calls fulfillRandomWords callback.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 2840 -Y 940 -Width 890 -Height 230 -Radius 22 `
  -ColorA "#3fa9f5" -ColorB "#1d3d6a" `
  -Title "RPC + EVENT LOGS" `
  -Lines @("RequestSent + Fulfilled tx snapshots.", "Source for history/proof rendering.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

# Lower support cards
Draw-GradientCard -Graphics $graphics -X 740 -Y 1270 -Width 1120 -Height 230 -Radius 22 `
  -ColorA "#6bee5b" -ColorB "#1f4a1b" `
  -Title "FULFILLMENT + PROOF CHECKS" `
  -Lines @("Checks: requestId, tx hash, and random words consistency.", "Feeds Post-Redeem, CRE Engine, and Proof Log tabs.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

Draw-GradientCard -Graphics $graphics -X 1980 -Y 1270 -Width 1120 -Height 230 -Radius 22 `
  -ColorA "#ffb347" -ColorB "#5a3815" `
  -Title "EXPLORER LINKS" `
  -Lines @("Requests/History/Proof use tx hash shortcuts.", "Opens external chain explorer for verification.") `
  -TitleFont $cardTitleFont -TextFont $cardTextFont -TitleBrush $textBrush -TextBrush $mutedBrush

# Read paths from panel to sections
Draw-Arrow -Graphics $graphics -X1 1920 -Y1 290 -X2 450 -Y2 360 -ColorHex "#5ddcff" -Thickness 3.3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 1920 -Y1 290 -X2 1185 -Y2 360 -ColorHex "#5ddcff" -Thickness 3.3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 1920 -Y1 290 -X2 1920 -Y2 360 -ColorHex "#5ddcff" -Thickness 3.3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 1920 -Y1 290 -X2 2655 -Y2 360 -ColorHex "#5ddcff" -Thickness 3.3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 1920 -Y1 290 -X2 3390 -Y2 360 -ColorHex "#5ddcff" -Thickness 3.3 -Dashed $true

# Sections -> shared model
Draw-Arrow -Graphics $graphics -X1 450 -Y1 550 -X2 1210 -Y2 640 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 1185 -Y1 550 -X2 1510 -Y2 640 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 1920 -Y1 550 -X2 1920 -Y2 640 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 2655 -Y1 550 -X2 2330 -Y2 640 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 3390 -Y1 550 -X2 2630 -Y2 640 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true

# Tx and VRF request/callback flow
Draw-Arrow -Graphics $graphics -X1 970 -Y1 1055 -X2 1020 -Y2 1055 -ColorHex "#f8f9ff" -Thickness 3.5 -Dashed $false
Draw-Arrow -Graphics $graphics -X1 1880 -Y1 1055 -X2 1930 -Y2 1055 -ColorHex "#9b7bff" -Thickness 4 -Dashed $false
Draw-Arrow -Graphics $graphics -X1 1930 -Y1 1115 -X2 1880 -Y2 1115 -ColorHex "#6bee5b" -Thickness 4 -Dashed $false
Draw-Arrow -Graphics $graphics -X1 1880 -Y1 1085 -X2 2840 -Y2 1085 -ColorHex "#27d9d2" -Thickness 3.8 -Dashed $false

# Event reads back into model
Draw-Arrow -Graphics $graphics -X1 2840 -Y1 970 -X2 2520 -Y2 860 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true
Draw-Arrow -Graphics $graphics -X1 2520 -Y1 860 -X2 2450 -Y2 860 -ColorHex "#5ddcff" -Thickness 3 -Dashed $true

# Model feeds proof/explorer layers
Draw-Arrow -Graphics $graphics -X1 1520 -Y1 860 -X2 1300 -Y2 1270 -ColorHex "#6bee5b" -Thickness 3.5 -Dashed $false
Draw-Arrow -Graphics $graphics -X1 2320 -Y1 860 -X2 2540 -Y2 1270 -ColorHex "#ffb347" -Thickness 3.5 -Dashed $false

# Proof + history to explorer audit
Draw-Arrow -Graphics $graphics -X1 3040 -Y1 550 -X2 2780 -Y2 1270 -ColorHex "#f8f9ff" -Thickness 3 -Dashed $false
Draw-Arrow -Graphics $graphics -X1 1535 -Y1 550 -X2 2280 -Y2 1270 -ColorHex "#f8f9ff" -Thickness 3 -Dashed $false

# Legend
$legendY = 1832
$legendPenRead = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 93, 220, 255), 3)
$legendPenRead.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$graphics.DrawLine($legendPenRead, 80, $legendY + 8, 190, $legendY + 8)
$graphics.DrawString("Read path", $legendFont, $readBrush, 202, $legendY - 4)

$legendPenSigned = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 248, 249, 255), 3)
$graphics.DrawLine($legendPenSigned, 520, $legendY + 8, 630, $legendY + 8)
$graphics.DrawString("Signed tx", $legendFont, $signedBrush, 642, $legendY - 4)

$legendPenRequest = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 155, 123, 255), 4)
$graphics.DrawLine($legendPenRequest, 980, $legendY + 8, 1090, $legendY + 8)
$graphics.DrawString("VRF request", $legendFont, $requestBrush, 1102, $legendY - 4)

$legendPenCallback = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 107, 238, 91), 4)
$graphics.DrawLine($legendPenCallback, 1490, $legendY + 8, 1600, $legendY + 8)
$graphics.DrawString("VRF callback", $legendFont, $callbackBrush, 1612, $legendY - 4)

$legendPenEvents = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 39, 217, 210), 4)
$graphics.DrawLine($legendPenEvents, 2010, $legendY + 8, 2120, $legendY + 8)
$graphics.DrawString("Event / log flow", $legendFont, $eventBrush, 2132, $legendY - 4)

$legendPenRead.Dispose()
$legendPenSigned.Dispose()
$legendPenRequest.Dispose()
$legendPenCallback.Dispose()
$legendPenEvents.Dispose()

$footerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(120, 93, 220, 255), 2)
$graphics.DrawLine($footerPen, 58, 2036, ($width - 58), 2036)
$graphics.DrawString("Generated VRF schema PNG for VRF panel", $footerFont, $mutedBrush, 64, 2048)
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
$readBrush.Dispose()
$signedBrush.Dispose()
$requestBrush.Dispose()
$callbackBrush.Dispose()
$eventBrush.Dispose()

$titleFont.Dispose()
$subTitleFont.Dispose()
$cardTitleFont.Dispose()
$cardTextFont.Dispose()
$legendFont.Dispose()
$footerFont.Dispose()

$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated $outFile"
