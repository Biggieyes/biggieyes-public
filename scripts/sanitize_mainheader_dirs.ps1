$star = [char]0x2605
$white = [char]0x2606
$dirs = Get-ChildItem src\MAINHEADER\PANELS -Directory | Where-Object { $_.Name -like "*${star}*" -or $_.Name -like "*${white}*" }
if ($dirs.Count -eq 0) { Write-Output 'No unicode-named dirs found.' } else {
  foreach ($d in $dirs) {
    $orig = $d.Name
    $new = ($orig -replace '[^A-Za-z0-9_-]','')
    if (-not $new) { $new = 'panel_'+([guid]::NewGuid().ToString().Substring(0,8)) }
    $dst = Join-Path $d.Parent.FullName $new
    if (!(Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
    robocopy $d.FullName $dst /E /NFL /NDL /NJH /NJS | Out-Null
    Remove-Item $d.FullName -Recurse -Force
    Write-Output "Merged '$orig' -> '$new'"
  }
}

Write-Output "\n--- Panels now ---"
Get-ChildItem src\MAINHEADER\PANELS -Directory | Select-Object Name

Write-Output "\n--- Remaining special-character occurrences (if any) ---"
$rem = Select-String -Path 'src\**\*.*' -Pattern ($star + '|' + $white) -SimpleMatch -List -ErrorAction SilentlyContinue
if ($rem) { $rem | Select-Object Path,LineNumber | Format-Table -AutoSize } else { Write-Output 'No remaining occurrences found.' }

Write-Output "\n--- Candidate panel files outside MAINHEADER (first 200) ---"
Get-ChildItem -Path src -Recurse -Include *Panel*.js,*Panel*.jsx,*Panel*.ts,*Panel*.tsx -File | Where-Object { $_.FullName -notlike '*\\MAINHEADER\\*' } | Select-Object -First 200 FullName
