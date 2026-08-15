$backup = 'src\\MAINHEADER_backup_20260108_091114'
if (!(Test-Path $backup)) { Write-Output "Backup not found: $backup"; exit 1 }
$curRoot = (Get-Item 'src\\MAINHEADER').FullName
$bakRoot = (Get-Item $backup).FullName
$curItems = Get-ChildItem -Path $curRoot -Recurse -File | ForEach-Object { $_.FullName.Substring($curRoot.Length+1).Replace('\\','/') }
$bakItems = Get-ChildItem -Path $bakRoot -Recurse -File | ForEach-Object { $_.FullName.Substring($bakRoot.Length+1).Replace('\\','/') }
$onlyInBak = $bakItems | Where-Object { $_ -notin $curItems }
$onlyInCur = $curItems | Where-Object { $_ -notin $bakItems }
Write-Output "backup_count=$($bakItems.Count) current_count=$($curItems.Count) onlyInBackup=$($onlyInBak.Count) onlyInCurrent=$($onlyInCur.Count)"
Write-Output "\n--- Files only in backup (sample up to 200) ---"
$onlyInBak | Select-Object -First 200 | ForEach-Object { Write-Output $_ }
Write-Output "\n--- Files only in current (sample up to 200) ---"
$onlyInCur | Select-Object -First 200 | ForEach-Object { Write-Output $_ }
