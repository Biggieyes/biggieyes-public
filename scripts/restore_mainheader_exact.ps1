$root = 'src\MAINHEADER'
$backupRoot = 'src\MAINHEADER_backup_20260108_091114\MAINHEADER'
if (!(Test-Path $backupRoot)) { Write-Output "Backup source not found: $backupRoot"; exit 1 }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
# backup current
$pre = "src\MAINHEADER_fullBackup_$ts"
if (Test-Path $root) { New-Item -ItemType Directory -Path $pre -Force | Out-Null; robocopy $root $pre /E /COPYALL /NFL /NDL /NJH /NJS | Out-Null; Write-Output "Backed up existing MAINHEADER to $pre" }

# remove embedded backup folder under src\MAINHEADER if present (commonly path 'p')
$embedded = Join-Path $root 'p'
if (Test-Path $embedded) { Write-Output "Removing embedded backup path: $embedded"; Remove-Item -Path $embedded -Recurse -Force }

# prepare new MAINHEADER dir
$new = "src\MAINHEADER_new_$ts"
if (Test-Path $new) { Remove-Item -Path $new -Recurse -Force }
New-Item -ItemType Directory -Path $new | Out-Null

# mapping for starred folders
$map = @{
  '★☆COLLECTION☆★'='COLLECTION';
  '★☆ECOSYSTEM☆★'='ECOSYSTEM';
  '★☆COMMUNITYCENTER☆★'='COMMUNITYCENTER';
  '★☆REWARDS☆★'='REWARDS';
  '★☆USERPANEL☆★'='USERPANEL';
  '★☆VRF☆★'='VRF'
}

# copy and sanitize names from backup into new
$files = Get-ChildItem -Path $backupRoot -Recurse -File
foreach ($f in $files) {
  $rel = $f.FullName.Substring($backupRoot.Length+1).TrimStart('\')
  $relNorm = $rel
  foreach ($k in $map.Keys) { $relNorm = $relNorm -replace [regex]::Escape($k), $map[$k] }
  $dest = Join-Path $new $relNorm
  $destDir = Split-Path $dest -Parent
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item -Path $f.FullName -Destination $dest -Force
}

# replace existing MAINHEADER with new one (after backing up done already)
# remove old
if (Test-Path $root) { Remove-Item -Path $root -Recurse -Force }
# move new into place
Move-Item -Path $new -Destination $root
Write-Output "Replaced src/MAINHEADER with sanitized backup contents."

# final cleanup: remove any remaining starred dirs under PANELS
$panels = Join-Path $root 'PANELS'
if (Test-Path $panels) {
  Get-ChildItem -Path $panels -Directory | Where-Object { $_.Name -match '[★☆]' } | ForEach-Object { Write-Output "Removing leftover starred dir: $($_.FullName)"; Remove-Item -Path $_.FullName -Recurse -Force }
}

# show final tree
cmd /c tree /F src\MAINHEADER
