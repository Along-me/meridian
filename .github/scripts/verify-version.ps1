param([string]$Tag)
$ErrorActionPreference = 'Stop'
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$lock = Get-Content package-lock.json -Raw | ConvertFrom-Json -AsHashtable
if ($lock.version -ne $version -or $lock.packages[''].version -ne $version -or $version -notmatch '^\d+\.\d+\.\d+$') {
  throw 'Package and lock versions must match a stable version.'
}
if ($Tag -and $Tag -ne "v$version") { throw 'Tag must match the package version.' }
Write-Output "Verified Meridian $version"
