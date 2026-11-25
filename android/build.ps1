$ErrorActionPreference = "Stop"

$SDK_DIR = "C:\Users\anikh\AppData\Local\Android\Sdk"
$BUILD_TOOLS = "$SDK_DIR\build-tools\36.0.0"
$AAPT2 = "$BUILD_TOOLS\aapt2.exe"
$D8 = "$BUILD_TOOLS\d8.bat"
$ZIPALIGN = "$BUILD_TOOLS\zipalign.exe"
$APKSIGNER = "$BUILD_TOOLS\apksigner.bat"
$ANDROID_JAR = "$SDK_DIR\platforms\android-34\android.jar"

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$JAVAC = "$env:JAVA_HOME\bin\javac.exe"
$KEYTOOL = "$env:JAVA_HOME\bin\keytool.exe"
$JAR = "$env:JAVA_HOME\bin\jar.exe"

$ROOT = "C:\Users\anikh\Desktop\bikroynow.com v1.0\android"
$BUILD_DIR = "$ROOT\build"
$RES_DIR = "$ROOT\app\src\main\res"
$MANIFEST = "$ROOT\app\src\main\AndroidManifest.xml"
$SRC_DIR = "$ROOT\app\src\main\java"

Write-Host "--- 1. Cleaning build directory ---"
if (Test-Path $BUILD_DIR) { Remove-Item -Recurse -Force $BUILD_DIR }
New-Item -ItemType Directory -Force -Path "$BUILD_DIR\compiled_res", "$BUILD_DIR\gen", "$BUILD_DIR\classes", "$BUILD_DIR\output" | Out-Null

Write-Host "--- 2. Compiling resources with aapt2 ---"
& $AAPT2 compile --dir $RES_DIR -o "$BUILD_DIR\compiled_res"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "--- 3. Linking resources with aapt2 ---"
$flatFiles = Get-ChildItem "$BUILD_DIR\compiled_res\*.flat" | ForEach-Object { $_.FullName }
& $AAPT2 link -I $ANDROID_JAR --manifest $MANIFEST --java "$BUILD_DIR\gen" -o "$BUILD_DIR\unaligned_no_dex.apk" --auto-add-overlay $flatFiles
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "--- 4. Compiling Java sources ---"
$javaFiles = @(
    Get-ChildItem -Path "$SRC_DIR" -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }
    Get-ChildItem -Path "$BUILD_DIR\gen" -Filter "*.java" -Recurse | ForEach-Object { $_.FullName }
)
& $JAVAC -cp $ANDROID_JAR -d "$BUILD_DIR\classes" --release 8 $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "--- 5. Compiling classes to DEX with d8 ---"
$classFiles = Get-ChildItem -Path "$BUILD_DIR\classes" -Filter "*.class" -Recurse | ForEach-Object { $_.FullName }
& $D8 --lib $ANDROID_JAR --output "$BUILD_DIR" $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "--- 6. Adding classes.dex to APK ---"
Copy-Item "$BUILD_DIR\unaligned_no_dex.apk" "$BUILD_DIR\unaligned.apk" -Force
Push-Location $BUILD_DIR
& $JAR uf "$BUILD_DIR\unaligned.apk" "classes.dex"
Pop-Location

Write-Host "--- 7. Aligning APK with zipalign ---"
& $ZIPALIGN -p -f 4 "$BUILD_DIR\unaligned.apk" "$BUILD_DIR\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "--- 8. Ensuring Release Keystore exists ---"
$KEYSTORE = "$ROOT\bikroynow-release.jks"
$KEY_ALIAS = "bikroynow"
$KEY_PASS = "bikroynow2026"
if (-not (Test-Path $KEYSTORE)) {
    Write-Host "Generating official release keystore..."
    & $KEYTOOL -genkeypair -v -keystore $KEYSTORE -alias $KEY_ALIAS -keyalg RSA -keysize 2048 -validity 10000 -storepass $KEY_PASS -keypass $KEY_PASS -dname "CN=BikroyNow, OU=Mobile, O=BikroyNow Technologies, L=Dhaka, ST=Dhaka, C=BD"
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

Write-Host "--- 9. Signing APK with apksigner (V1, V2, V3) ---"
$FINAL_APK = "$ROOT\BikroyNow.apk"
& $APKSIGNER sign --ks $KEYSTORE --ks-key-alias $KEY_ALIAS --ks-pass "pass:$KEY_PASS" --key-pass "pass:$KEY_PASS" --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $FINAL_APK "$BUILD_DIR\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner sign failed" }

Write-Host "--- 10. Verifying APK signature ---"
& $APKSIGNER verify --verbose $FINAL_APK

$size = (Get-Item $FINAL_APK).Length
$sizeMB = [math]::Round($size / 1MB, 2)
Write-Host "SUCCESS! Generated APK at $FINAL_APK with size: $sizeMB MB"
