$ts = Get-Date -Format yyyyMMdd_HHmmss
$backup = Join-Path (Get-Location) ("src_MAINHEADER_preMoveBackup_" + $ts)
Write-Output "Backing up src\MAINHEADER to $backup"
Copy-Item -LiteralPath ".\src\MAINHEADER" -Destination $backup -Recurse -Force

$found = Get-ChildItem -LiteralPath ".\src\MAINHEADER" -Recurse -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'PANELS') } | Select-Object -First 1
if (-not $found) { Write-Error "No candidate MAINHEADER with PANELS found."; exit 1 }

Write-Output ("Found source: " + $found.FullName)
$temp = Join-Path (Get-Location) ("src_MAINHEADER_temp_" + $ts)
Write-Output ("Copying from " + $found.FullName + " to " + $temp)
robocopy $found.FullName $temp /E /NFL /NDL /NJH /NJS /NP | Out-Null

if (-not (Test-Path (Join-Path $temp 'PANELS'))) { Write-Error "Temp copy missing PANELS"; exit 1 }

Write-Output "Replacing src\MAINHEADER with temp copy"
Remove-Item -LiteralPath ".\src\MAINHEADER" -Recurse -Force
New-Item -ItemType Directory -Path ".\src\MAINHEADER" | Out-Null
robocopy $temp ".\src\MAINHEADER" /E /NFL /NDL /NJH /NJS /NP | Out-Null

Write-Output "Verifying..."
if (Test-Path ".\src\MAINHEADER\PANELS") { Write-Output "SUCCESS: PANELS at root" } else { Write-Error "FAILED: PANELS not at root"; exit 1 }

Write-Output "Removing temp and old nested backup folder"
Remove-Item -LiteralPath $temp -Recurse -Force

$nested = ".\src\MAINHEADER\BIGGINFTWEB"
if (Test-Path $nested) { Write-Output ("Removing nested " + $nested); Remove-Item -LiteralPath $nested -Recurse -Force }

Write-Output "Done"
