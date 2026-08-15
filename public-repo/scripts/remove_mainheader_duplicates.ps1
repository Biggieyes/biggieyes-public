$root = 'src\MAINHEADER'
if (!(Test-Path $root)) { Write-Output "Directory not found: $root"; exit 1 }
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$dupBackup = "src\MAINHEADER_duplicates_backup_$ts"
New-Item -ItemType Directory -Path $dupBackup -Force | Out-Null

# Gather files and hashes
$files = Get-ChildItem -Path $root -Recurse -File
Write-Output "Found $($files.Count) files under $root"
$hashMap = @{}
foreach ($f in $files) {
  try {
    $h = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash
  } catch {
    $h = 'ERR' + [guid]::NewGuid().ToString()
  }
  if (-not $hashMap.ContainsKey($h)) { $hashMap[$h] = @() }
  $hashMap[$h] += $f.FullName
}

$removed = @()
foreach ($h in $hashMap.Keys) {
  $group = $hashMap[$h]
  if ($group.Count -gt 1) {
    # choose the best file to keep
    $sorted = $group | Sort-Object {
      if ($_ -match 'backup|preCopy|renameBackup|preRestore') { 1 } else { 0 }
    },{$_}
    $keep = $sorted[0]
    $dups = $sorted | Select-Object -Skip 1
    foreach ($d in $dups) {
      $rel = $d.Substring((Get-Item $root).FullName.Length+1)
      $dest = Join-Path $dupBackup $rel
      $destDir = Split-Path $dest -Parent
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      Copy-Item -Path $d -Destination $dest -Force
      Remove-Item -Path $d -Force
      $removed += @{removed=$d; kept=$keep}
      Write-Output "Removed duplicate: $d  (kept: $keep)"
    }
  }
}

Write-Output "\nDuplicates removed: $($removed.Count)"
if ($removed.Count -gt 0) { Write-Output "Backup of removed files at: $dupBackup" } else { Write-Output 'No duplicates found.' }

# Final counts
$total = (Get-ChildItem -Path $root -Recurse -File | Measure-Object).Count
Write-Output ("Total files now in {0}: {1}" -f ${root}, $total)

# Save a CSV of removals
if ($removed.Count -gt 0) {
  $csv = "$dupBackup\removed_files.csv"
  $removed | ForEach-Object { $_ } | ConvertTo-Csv -NoTypeInformation | Set-Content $csv -Encoding utf8
  Write-Output "Removed list saved: $csv"
}
