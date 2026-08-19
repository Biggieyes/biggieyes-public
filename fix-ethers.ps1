Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host '=== Biggi: starting fix-ethers script (ethers v5) ===' -ForegroundColor Cyan
# Save and relax error action for external npm commands
$originalEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'

# 1) Backup .npmrc (project + user)
if (Test-Path .\.npmrc) {
  $ts = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $bak = ".npmrc.backup.$ts"
  Copy-Item -LiteralPath .\.npmrc -Destination $bak -Force
  Write-Host "Project .npmrc backed up: $bak"
} else {
  Write-Host 'Project .npmrc not found.'
}

$usrNpmrc = Join-Path $env:USERPROFILE '.npmrc'
if (Test-Path $usrNpmrc) {
  $ts = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $bakUsr = "$usrNpmrc.backup.$ts"
  Copy-Item -LiteralPath $usrNpmrc -Destination $bakUsr -Force
  Write-Host "User .npmrc backed up: $bakUsr"
} else {
  Write-Host 'User .npmrc not found.'
}

# 2) Remove node_modules and package-lock.json
if (Test-Path .\node_modules) {
  Write-Host 'Removing node_modules (may take a while)...'
  Remove-Item -LiteralPath .\node_modules -Recurse -Force
  Write-Host 'node_modules removed.'
} else {
  Write-Host 'node_modules does not exist.'
}

if (Test-Path .\package-lock.json) {
  Remove-Item -LiteralPath .\package-lock.json -Force
  Write-Host 'package-lock.json removed.'
} else {
  Write-Host 'package-lock.json not found.'
}

# 3) Set registry to official npm
Write-Host 'Setting npm registry to https://registry.npmjs.org/ ...'
npm config set registry https://registry.npmjs.org/
Write-Host 'Current registry:' (npm config get registry)

# 4) Logout (clean start) and clean cache
Write-Host 'Running npm logout (if logged in) ...'
& npm logout 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'npm logout failed or not logged in — continuing.'
}
Write-Host 'Cleaning npm cache (force) ...'
npm cache clean --force

# 5) Install ethers v5.8.0
Write-Host 'Installing ethers@5.8.0 ...'
npm install ethers@5.8.0 --save

# 6) Standard install of project dependencies
Write-Host 'Running npm install ...'
npm install

# 7) Verification checks
Write-Host 'Checking installed versions (ethers and selected @ethersproject packages):'
& npm ls ethers @ethersproject/abi @ethersproject/providers @ethersproject/utils 2>$null
if ($LASTEXITCODE -ne 0) { & npm ls ethers 2>$null }

Write-Host "Done. If errors (auth, 404, or UNMET) appeared, check .npmrc or run 'npm login'."
Write-Host 'If needed, please send output of: npm ls ethers @ethersproject/abi @ethersproject/providers'

# Restore original error action preference
$ErrorActionPreference = $originalEAP

Write-Host '=== Script completed ===' -ForegroundColor Green

