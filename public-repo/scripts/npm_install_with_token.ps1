$ErrorActionPreference = 'Stop'
$token = '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'
$npmrc = Join-Path (Get-Location) '.npmrc'
$content = "//registry.npmjs.org/:_authToken=$token"
Set-Content -LiteralPath $npmrc -Value $content -NoNewline

try {
    Write-Output 'Running npm install (using temporary .npmrc)...'
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed ($LASTEXITCODE)" }

    Write-Output 'npm install completed. Running npm run build...'
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed ($LASTEXITCODE)" }

    Write-Output 'Install and build completed successfully.'
}
catch {
    Write-Error "Error: $_"
    exit 1
}
finally {
    if (Test-Path $npmrc) { Remove-Item $npmrc -Force }
}
