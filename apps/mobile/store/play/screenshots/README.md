# Play Store screenshots — Notai

Drop final assets into `apps/mobile/store/play/screenshots/<locale>/`
(default locale: `en-US`). Sizes follow Google Play 2024 spec.

## Required (Play Console rejects submissions missing these)

| Slot                  | Spec                                       | Status |
| --------------------- | ------------------------------------------ | ------ |
| Phone screenshots     | 2–8, 16:9 or 9:16, min edge 320 px         | TODO   |
| Feature graphic       | 1024 × 500, JPG/PNG, no transparency       | TODO   |
| App icon              | 512 × 512, 32-bit PNG with alpha           | Auto (from `assets/icon.png` via `pnpm -F @notai/mobile assets`) |

## Optional but recommended

| Slot                  | Spec                                       |
| --------------------- | ------------------------------------------ |
| 7-inch tablet shots   | 1024–7680 px on the long edge, 1:2 to 2:1  |
| 10-inch tablet shots  | same range as above                        |
| Promo video           | YouTube URL, ≤ 30 s                        |

## Capture script

The fastest way is the Android Studio emulator + the debug APK:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# 1. Boot a Pixel 7 AVD from Android Studio (or `emulator -avd Pixel_7_API_34`).
# 2. Install the debug APK:
adb install -r e:\gh\notai\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
# 3. Capture each screen (will produce a PNG in the cwd):
adb exec-out screencap -p > screen-01-dashboard.png
```

Intended sequence (matches `listing.md` description):

1. `screen-01-dashboard.png` — morning brief + today's tasks
2. `screen-02-canvas.png` — note with cover image + drawing
3. `screen-03-stickies.png` — sticky notes overview
4. `screen-04-prompt.png` — daily prompt card
5. `screen-05-privacy.png` — Settings → privacy / data export

## Feature graphic

A 1024 × 500 PNG with the wordmark on a calm gradient. Until a final
asset lands, generate one from the icon source by running the
forthcoming `scripts/feature-graphic.mjs` (TODO — out of scope for
this scaffold; use Figma export for now).
