$root = 'src\MAINHEADER'
if (!(Test-Path $root)) { Write-Output "Directory not found: $root"; exit 1 }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "src\MAINHEADER_before_finalCleanup_$ts"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
robocopy $root $backup /E /COPYALL /NFL /NDL /NJH /NJS | Out-Null
Write-Output "Backed up current MAINHEADER to $backup"

# Mapping for starred folders
$map = @{
  '★☆COLLECTION☆★'='COLLECTION'
  '★☆ECOSYSTEM☆★'='ECOSYSTEM'
  '★☆COMMUNITYCENTER☆★'='COMMUNITYCENTER'
  '★☆REWARDS☆★'='REWARDS'
  '★☆USERPANEL☆★'='USERPANEL'
  '★☆VRF☆★'='VRF'
}

# Rename starred panel folders under PANELS if present
$panels = Join-Path $root 'PANELS'
if (Test-Path $panels) {
  foreach ($k in $map.Keys) {
    $src = Join-Path $panels $k
    if (Test-Path $src) {
      $dst = Join-Path $panels $map[$k]
      if (!(Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
      robocopy $src $dst /E /NFL /NDL /NJH /NJS | Out-Null
      Remove-Item $src -Recurse -Force
      Write-Output "Merged/renamed folder: '$k' -> '$($map[$k])'"
    }
  }
}

# Replace starred folder tokens inside source files
$updated=0
Get-ChildItem -Path src -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.json -File | ForEach-Object {
  $p=$_.FullName
  try {
    $t=Get-Content $p -Raw -ErrorAction Stop
    $orig=$t
    foreach ($k in $map.Keys) { $t = $t -replace [regex]::Escape($k), $map[$k] }
    if ($t -ne $orig) { Set-Content $p $t -Encoding utf8; $updated++; Write-Output "Updated refs: $p" }
  } catch { }
}
Write-Output "Reference files updated: $updated"

# Remove embedded backup paths and other MAINHEADER_* backups under src
$patterns = @('src\\MAINHEADER_backup_*','src\\MAINHEADER_pre*','src\\MAINHEADER_renameBackup_*','src\\MAINHEADER_fullBackup_*','src\\MAINHEADER_preCopy_*')
foreach ($pat in $patterns) {
  Get-ChildItem -Path src -Directory -Force | Where-Object { $_.FullName -like $pat } | ForEach-Object { Write-Output "Removing backup dir: $($_.FullName)"; Remove-Item -Path $_.FullName -Recurse -Force }
}

# Also remove any embedded path folder named 'BIGGINFTWEB' under src\MAINHEADER if it's from nested backup
$embedded = Join-Path $root 'BIGGINFTWEB'
if (Test-Path $embedded) { Write-Output "Removing embedded nested backup path: $embedded"; Remove-Item -Path $embedded -Recurse -Force }

# Final: ensure only the desired set remains by listing tree
Write-Output "\nFinal `src/MAINHEADER` tree:"
cmd /c tree /F src\MAINHEADER

# Report remaining occurrences of star characters
$rem = Select-String -Path 'src\**\*.*' -Pattern '★|☆' -SimpleMatch -List -ErrorAction SilentlyContinue
if ($rem) { Write-Output "\nWARNING: Remaining star occurrences:"; $rem | Select-Object Path,LineNumber | Format-Table -AutoSize } else { Write-Output 'No remaining star characters found in src.' }
