# Builds a signed APK locally; add -AppBundle for a Play AAB.
# One-time setup: download the EAS keystore (credentials.json), then run
#   .\scripts\build-apk.ps1 -Import path\to\credentials.json
param(
    [string]$Import,
    [string]$KeyDirectory = (Join-Path $PSScriptRoot '..\..\..\..\keys'),
    [switch]$AppBundle
)

$ErrorActionPreference = 'Stop'
$mobile = Resolve-Path (Join-Path $PSScriptRoot '..')
$keyPath = Join-Path $KeyDirectory 'miscellary-upload.jks'
$secretPath = Join-Path $KeyDirectory 'miscellary-keystore.xml'

if ($Import) {
    $credentials = (Get-Content -LiteralPath $Import -Raw | ConvertFrom-Json).android.keystore
    $source = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $Import)) $credentials.keystorePath
    New-Item -ItemType Directory -Force -Path $KeyDirectory | Out-Null
    Copy-Item -LiteralPath $source -Destination $keyPath -Force
    # Encrypted for this Windows user only (DPAPI), like Portlore's upload password.
    @{
        alias         = $credentials.keyAlias
        storePassword = ConvertTo-SecureString $credentials.keystorePassword -AsPlainText -Force
        keyPassword   = ConvertTo-SecureString $credentials.keyPassword -AsPlainText -Force
    } | Export-Clixml -LiteralPath $secretPath
    Write-Host "Saved the keystore to $KeyDirectory. Delete credentials.json and its keystore file now."
    return
}

if (-not (Test-Path -LiteralPath $keyPath) -or -not (Test-Path -LiteralPath $secretPath)) {
    throw 'No keystore yet. Download it from EAS and run this script with -Import (see the top of this file).'
}

# Gradle for React Native 0.81 needs JDK 17 or 21; newer JDKs fail.
$jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Microsoft' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^jdk-(17|21)\.' } | Sort-Object Name -Descending | Select-Object -First 1
if (-not $jdk) { throw 'Install JDK 21 (Eclipse Adoptium) to build locally.' }

$saved = @{}
function Set-BuildEnv([string]$name, [string]$value) {
    $saved[$name] = [Environment]::GetEnvironmentVariable($name)
    [Environment]::SetEnvironmentVariable($name, $value)
}

Push-Location $mobile
# Windows PowerShell treats anything a native tool prints to stderr as an error; exit codes decide here.
$ErrorActionPreference = 'Continue'
try {
    Set-BuildEnv 'JAVA_HOME' $jdk.FullName
    # Gradle passes Metro an entry path relative to apps/mobile; serve from here, not the workspace root.
    Set-BuildEnv 'EXPO_NO_METRO_WORKSPACE_ROOT' '1'
    $profile = if ($AppBundle) { 'production' } else { 'preview' }
    $easEnv = (Get-Content 'eas.json' -Raw -ErrorAction Stop | ConvertFrom-Json).build.$profile.env
    foreach ($property in $easEnv.PSObject.Properties) {
        if ($property.Name -like 'EXPO_PUBLIC_*') { Set-BuildEnv $property.Name $property.Value }
    }

    & pnpm.cmd surfaces:build
    if ($LASTEXITCODE -ne 0) { throw 'Surface build failed.' }
    & npx.cmd expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }

    # Prebuild can drop local.properties; Windows also needs CMake 3.31 for long native paths.
    $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    $properties = @("sdk.dir=$($sdk -replace '\\', '/' -replace ':', '\:')")
    $cmake = Join-Path $sdk 'cmake\3.31.6'
    if (Test-Path -LiteralPath $cmake) { $properties += "cmake.dir=$($cmake -replace '\\', '/' -replace ':', '\:')" }
    Set-Content -LiteralPath 'android\local.properties' -Value $properties -Encoding ascii

    $versionCode = (Get-Content 'app.json' -Raw -ErrorAction Stop | ConvertFrom-Json).expo.android.versionCode
    if ($versionCode -isnot [int] -or $versionCode -lt 1) { throw 'Set android.versionCode in app.json before building.' }
    $gradleFile = 'android\app\build.gradle'
    $gradle = (Get-Content $gradleFile -Raw) -replace 'versionCode \d+', "versionCode $versionCode"

    # Gradle runs hermesc through cmd without quotes, which breaks on the spaces in "Collector TC App".
    $reactNative = Split-Path -Parent (& node --print "require.resolve('react-native/package.json')")
    $hermesc = Join-Path $env:LOCALAPPDATA 'miscellary-build\hermesc'
    if (Test-Path -LiteralPath $hermesc) {
        $resolvedHermesc = (Resolve-Path -LiteralPath $hermesc).Path
        $buildRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'miscellary-build')) + [IO.Path]::DirectorySeparatorChar
        if (-not $resolvedHermesc.StartsWith($buildRoot, [StringComparison]::OrdinalIgnoreCase) -or
            ((Get-Item -LiteralPath $hermesc).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Unexpected hermesc cleanup path.'
        }
    }
    Remove-Item -LiteralPath $hermesc -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -LiteralPath (Join-Path $reactNative 'sdks\hermesc') -Destination $hermesc -Recurse
    if ($hermesc -match ' ') { throw "hermesc needs a path without spaces: $hermesc" }
    $gradle = $gradle -replace '(?m)^(\s*)hermesCommand = .*$', "`$1hermesCommand = `"$($hermesc -replace '\\', '/')/%OS-BIN%/hermesc`""
    Set-Content $gradleFile -Value $gradle -NoNewline

    # Passed as environment project properties so the passwords stay off the command line.
    $secret = Import-Clixml -LiteralPath $secretPath -ErrorAction Stop
    $plain = { param($s) [Net.NetworkCredential]::new('', $s).Password }
    Set-BuildEnv 'ORG_GRADLE_PROJECT_android.injected.signing.store.file' (Resolve-Path -LiteralPath $keyPath).Path
    Set-BuildEnv 'ORG_GRADLE_PROJECT_android.injected.signing.store.password' (& $plain $secret.storePassword)
    Set-BuildEnv 'ORG_GRADLE_PROJECT_android.injected.signing.key.alias' $secret.alias
    Set-BuildEnv 'ORG_GRADLE_PROJECT_android.injected.signing.key.password' (& $plain $secret.keyPassword)
    Push-Location 'android'
    try {
        # Shared web code and generated JSON are outside Gradle's default JavaScript inputs.
        $task = if ($AppBundle) { 'bundleRelease' } else { 'assembleRelease' }
        & .\gradlew.bat --no-daemon :app:createBundleReleaseJsAndAssets --rerun $task
        if ($LASTEXITCODE -ne 0) { throw 'Gradle release build failed.' }
    } finally {
        Pop-Location
    }
    $output = if ($AppBundle) { 'android\app\build\outputs\bundle\release\app-release.aab' } else { 'android\app\build\outputs\apk\release\app-release.apk' }
    Write-Host "Build: $(Resolve-Path -LiteralPath $output)"
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
    $secret = $null
    Pop-Location
}
