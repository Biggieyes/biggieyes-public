$root = 'src\MAINHEADER'
if (!(Test-Path $root)) { Write-Output "Directory not found: $root"; exit 1 }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "src\MAINHEADER_sanitizeBackup_$ts"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
robocopy $root $backup /E /COPYALL /NFL /NDL /NJH /NJS | Out-Null
Write-Output "Backed up MAINHEADER to $backup"

$panels = Join-Path $root 'PANELS'
$map = @{
  '★☆COLLECTION☆★'='COLLECTION'
  '★☆ECOSYSTEM☆★'='ECOSYSTEM'
  '★☆COMMUNITYCENTER☆★'='COMMUNITYCENTER'
  '★☆REWARDS☆★'='REWARDS'
  '★☆USERPANEL☆★'='USERPANEL'
  '★☆VRF☆★'='VRF'
}

# Merge starred dirs into ASCII dirs
foreach ($k in $map.Keys) {
  $src = Join-Path $panels $k
  $dst = Join-Path $panels $map[$k]
  if (Test-Path $src) {
    if (!(Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
    Write-Output "Merging $src -> $dst"
    # copy files without overwriting existing
    Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($src.Length+1).TrimStart('\\')
      $target = Join-Path $dst $rel
      $td = Split-Path $target -Parent
      if (!(Test-Path $td)) { New-Item -ItemType Directory -Path $td -Force | Out-Null }
      if (!(Test-Path $target)) { Copy-Item -Path $_.FullName -Destination $target -Force }
    }
    Remove-Item -Path $src -Recurse -Force
  }
}

# Replace starred tokens inside files
$updated=0
Get-ChildItem -Path src -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.json -File | ForEach-Object {
  $p=$_.FullName
  try {
    $t=Get-Content $p -Raw -ErrorAction Stop
    $orig=$t
    foreach ($k in $map.Keys) { $t = $t -replace [regex]::Escape($k), $map[$k] }
    if ($t -ne $orig) { Set-Content $p $t -Encoding utf8; $updated++ }
  } catch { }
}
Write-Output "Updated references in $updated files"

# Remove any remaining starred dirs under PANELS
if (Test-Path $panels) {
  Get-ChildItem -Path $panels -Directory | Where-Object { $_.Name -match '[★☆]' } | ForEach-Object { Write-Output "Removing leftover starred dir: $($_.FullName)"; Remove-Item -Path $_.FullName -Recurse -Force }
}

# Deduplicate by hash within MAINHEADER (keep first, backup removed)
$dupBackup = "src\MAINHEADER_duplicates_$ts"
New-Item -ItemType Directory -Path $dupBackup -Force | Out-Null
$hashMap = @{}
Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
  try { $h = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash } catch { $h = 'ERR' + [guid]::NewGuid().ToString() }
  if (-not $hashMap.ContainsKey($h)) { $hashMap[$h] = @() }
  $hashMap[$h] += $_.FullName
}
$removed=0
foreach ($h in $hashMap.Keys) {
  $group = $hashMap[$h]
  if ($group.Count -gt 1) {
    $keep = $group | Sort-Object | Select-Object -First 1
    $dups = $group | Where-Object { $_ -ne $keep }
    foreach ($d in $dups) {
      $rel = $d.Substring($root.Length+1).TrimStart('\\')
      $dest = Join-Path $dupBackup $rel
      $destDir = Split-Path $dest -Parent
      if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
      Copy-Item -Path $d -Destination $dest -Force
      Remove-Item -Path $d -Force
      $removed++
    }
  }
}
Write-Output "Removed $removed duplicate files (backed up to $dupBackup)"

# Final report
$cnt = (Get-ChildItem -Path $root -Recurse -File | Measure-Object).Count
Write-Output ("Total files in {0}: {1}" -f ${root}, $cnt)
$remStars = Select-String -Path 'src\**\*.*' -Pattern '★|☆' -SimpleMatch -List -ErrorAction SilentlyContinue
if ($remStars) { Write-Output "Remaining star occurrences found:"; $remStars | Select-Object Path,LineNumber | Format-Table -AutoSize } else { Write-Output 'No remaining star characters found.' }
Write-Output "\nFinal tree:"; cmd /c tree /F src\MAINHEADER
