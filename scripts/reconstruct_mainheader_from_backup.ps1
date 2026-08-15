$backupSrc = 'src\MAINHEADER_backup_20260108_091114\MAINHEADER'
$dest = 'src\MAINHEADER'
if (!(Test-Path $backupSrc)) { Write-Output "Backup source not found: $backupSrc"; exit 1 }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$pre = "src\MAINHEADER_restoreBackup_$ts"
if (Test-Path $dest) { New-Item -ItemType Directory -Path $pre -Force | Out-Null; robocopy $dest $pre /E /COPYALL /NFL /NDL /NJH /NJS | Out-Null; Write-Output "Backed up existing MAINHEADER to $pre" }

$tmp = "src\MAINHEADER_tmp_$ts"
if (Test-Path $tmp) { Remove-Item -Path $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null

$map = @{
  '★☆COLLECTION☆★'='COLLECTION'
  '★☆ECOSYSTEM☆★'='ECOSYSTEM'
  '★☆COMMUNITYCENTER☆★'='COMMUNITYCENTER'
  '★☆REWARDS☆★'='REWARDS'
  '★☆USERPANEL☆★'='USERPANEL'
  '★☆VRF☆★'='VRF'
}

$files = Get-ChildItem -Path $backupSrc -Recurse -File
Write-Output "Found $($files.Count) files in backup source. Copying..."
foreach ($f in $files) {
  $rel = $f.FullName.Substring($backupSrc.Length+1).TrimStart('\')
  $relNorm = $rel
  foreach ($k in $map.Keys) { $relNorm = $relNorm -replace [regex]::Escape($k), $map[$k] }
  $destPath = Join-Path $tmp $relNorm
  $destDir = Split-Path $destPath -Parent
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item -Path $f.FullName -Destination $destPath -Force
}

# Remove old dest and move tmp into place
if (Test-Path $dest) { Remove-Item -Path $dest -Recurse -Force }
Move-Item -Path $tmp -Destination $dest
Write-Output "Reconstructed src/MAINHEADER from backup and sanitized starred folders."

# Cleanup: remove known leftover backup folders under src
Get-ChildItem -Path src -Directory -Force | Where-Object { $_.Name -like 'MAINHEADER_backup_*' -or $_.Name -like 'MAINHEADER_*' } | ForEach-Object { if ($_.Name -ne 'MAINHEADER') { Write-Output "Removing backup dir: $($_.FullName)"; Remove-Item -Path $_.FullName -Recurse -Force } }

# Final tree
cmd /c tree /F src\MAINHEADER
