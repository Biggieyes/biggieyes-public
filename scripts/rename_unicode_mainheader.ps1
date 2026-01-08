$ts=Get-Date -Format "yyyyMMdd_HHmmss"
$backup="src\MAINHEADER_renameBackup_$ts"
if (Test-Path src\MAINHEADER) {
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  robocopy src\MAINHEADER $backup /E /COPYALL /NFL /NDL /NJH /NJS | Out-Null
  Write-Output "Backed up existing src\MAINHEADER to $backup"
} else { Write-Output 'No existing src\MAINHEADER directory to back up.' }

$map = @{
  '★☆COLLECTION☆★'='COLLECTION'
  '★☆COMMUNITYCENTER☆★'='COMMUNITYCENTER'
  '★☆ECOSYSTEM☆★'='ECOSYSTEM'
  '★☆REWARDS☆★'='REWARDS'
  '★☆USERPANEL☆★'='USERPANEL'
  '★☆VRF☆★'='VRF'
}

foreach ($k in $map.Keys) {
  $src = Join-Path 'src\MAINHEADER\PANELS' $k
  $dst = Join-Path 'src\MAINHEADER\PANELS' $map[$k]
  if (Test-Path $src) {
    if (!(Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
    robocopy $src $dst /E /NFL /NDL /NJH /NJS | Out-Null
    Remove-Item $src -Recurse -Force
    Write-Output "Renamed folder: '$k' -> '$($map[$k])'"
  } else {
    Write-Output "Folder not found: '$k'"
  }
}

Write-Output "\nUpdating import paths and references across 'src' (this may take a moment)..."
Get-ChildItem -Path src -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.json -File | ForEach-Object {
  $path = $_.FullName
  try {
    $text = Get-Content $path -Raw -ErrorAction Stop
    $orig = $text
    foreach ($k in $map.Keys) { $text = $text -replace [regex]::Escape($k), $map[$k] }
    if ($text -ne $orig) { Set-Content $path $text -Encoding utf8; Write-Output "Updated: $path" }
  } catch {
    # skip binary or unreadable files
  }
}

Write-Output "\n--- Panels dir listing ---"
Get-ChildItem -Path src\MAINHEADER\PANELS -Directory | Select-Object Name

Write-Output "\n--- Remaining special-character occurrences (if any) ---"
$rem = Select-String -Path 'src\**\*.*' -Pattern '★|☆' -SimpleMatch -List -ErrorAction SilentlyContinue
if ($rem) { $rem | Select-Object Path,LineNumber | Format-Table -AutoSize } else { Write-Output 'No remaining occurrences found.' }

Write-Output "\n--- Candidate panel files outside MAINHEADER (first 200) ---"
Get-ChildItem -Path src -Recurse -Include *Panel*.js,*Panel*.jsx,*Panel*.ts,*Panel*.tsx -File | Where-Object { $_.FullName -notlike '*\\MAINHEADER\\*' } | Select-Object -First 200 FullName
