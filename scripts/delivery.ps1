# Packages your work for submission. See scripts/delivery.mjs for details.
#
# This is a pass-through to Node on purpose. The previous PowerShell
# implementation enumerated files itself, which silently dropped the hidden
# repository metadata directory, flattened the archive so every file landed at
# the root, and failed to exclude node_modules.
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    # Write-Host, not Write-Error: under 'Stop' the latter raises a terminating
    # error, so the message below would render as a red error record and the
    # exit code would never be set.
    Write-Host @'
Node.js was not found on your PATH.
Node 18 or newer is a prerequisite of this project - install it and run this script again.
If you cannot install Node, email tech.challenge@eyecarepro.net and we will
arrange another way to receive your work.
'@ -ForegroundColor Red
    exit 1
}

# PowerShell 7.4+ turns a non-zero native exit code into a terminating error when
# $ErrorActionPreference is 'Stop', which would skip the `exit $LASTEXITCODE` below
# and lose node's real exit code. Harmless on Windows PowerShell 5.1, where this
# preference variable does not exist.
$PSNativeCommandUseErrorActionPreference = $false

& node (Join-Path $PSScriptRoot 'delivery.mjs') @args
exit $LASTEXITCODE
