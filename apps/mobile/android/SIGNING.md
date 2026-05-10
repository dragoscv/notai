# Android release signing — Notai

This document describes how to produce a **signed release AAB** ready to
upload to the Google Play Console. The Gradle build is wired to read
the keystore details from Gradle properties (`NOTAI_KEYSTORE_FILE`,
`NOTAI_KEYSTORE_PASSWORD`, `NOTAI_KEY_ALIAS`, `NOTAI_KEY_PASSWORD`) so
the keystore itself never enters this repo.

## 1. Generate a release keystore (one time)

> **Run this once.** Store the resulting `.jks` somewhere safe and
> backed up — losing it means you cannot publish updates to your app.
> Do **not** commit the keystore.

```powershell
# Use the Android Studio JBR so we hit a JDK 17 (matches the build).
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# Pick a directory OUTSIDE the repo:
$keystoreDir = "$env:USERPROFILE\.android-keystores\notai"
New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

keytool -genkey -v `
  -keystore "$keystoreDir\notai-release.jks" `
  -alias notai `
  -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` will prompt for **two passwords** (keystore + key) and a
distinguished name. Use the same password for both unless you have a
strong reason otherwise — Play App Signing handles the upload
certificate separately.

## 2. Create `keystore.properties` (gitignored)

Drop a file at `apps/mobile/android/keystore.properties` with the
exact paths and passwords you used above. The path goes in
forward-slash form so Gradle parses it on Windows:

```properties
NOTAI_KEYSTORE_FILE=C:/Users/<you>/.android-keystores/notai/notai-release.jks
NOTAI_KEYSTORE_PASSWORD=<the keystore password>
NOTAI_KEY_ALIAS=notai
NOTAI_KEY_PASSWORD=<the key password>
```

> **Do not commit this file.** It is added to `.gitignore` already.

## 3. Build a signed AAB

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

cd e:\gh\notai\apps\mobile\android
.\gradlew.bat -PNOTAI_KEYSTORE_FILE="$env:USERPROFILE\.android-keystores\notai\notai-release.jks" `
              -PNOTAI_KEYSTORE_PASSWORD="<keystore-password>" `
              -PNOTAI_KEY_ALIAS=notai `
              -PNOTAI_KEY_PASSWORD="<key-password>" `
              :app:bundleRelease
```

Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

This `.aab` is what you upload to the Play Console. Google handles
device-specific APK splitting for you (Play App Signing).

## 4. (Optional) Build a signed APK for sideloading

```powershell
.\gradlew.bat -PNOTAI_KEYSTORE_FILE=... -PNOTAI_KEYSTORE_PASSWORD=... `
              -PNOTAI_KEY_ALIAS=notai -PNOTAI_KEY_PASSWORD=... `
              :app:assembleRelease
```

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

## 5. Bumping versions

Edit `apps/mobile/android/app/build.gradle`:

- `versionCode` — integer, **must increase** for every Play upload.
- `versionName` — semantic string the user sees (`"1.0.1"`).

Both Gradle properties get baked into the AAB.

## 6. Future: load properties from the file automatically

To stop typing `-P…` flags every build, add this near the top of
`apps/mobile/android/app/build.gradle`:

```groovy
def keystorePropsFile = rootProject.file("keystore.properties")
if (keystorePropsFile.exists()) {
    def props = new Properties()
    keystorePropsFile.withInputStream { props.load(it) }
    props.each { k, v -> project.ext[k] = v }
}
```

We deliberately did **not** wire this up by default — the explicit
`-P` form makes the secret-pass surface visible in your shell history
so you don't lose track of where credentials are flowing.
