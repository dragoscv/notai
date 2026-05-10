# Capacitor Assets

`@capacitor/assets` reads source PNGs from this folder and generates every
icon + splash size required by Android and iOS.

Required source files (drop in here, then run `pnpm assets` from `apps/mobile`):

| File              | Size       | Notes                                            |
| ----------------- | ---------- | ------------------------------------------------ |
| `icon.png`        | 1024×1024  | Foreground + background combined; transparent OK |
| `icon-foreground.png` | 1024×1024 | Adaptive icon foreground (Android)             |
| `icon-background.png` | 1024×1024 | Adaptive icon background (Android, solid color) |
| `splash.png`      | 2732×2732  | Splash screen, light theme                       |
| `splash-dark.png` | 2732×2732  | Splash screen, dark theme (optional)             |

A pragmatic shortcut: copy `apps/web/public/icons/icon-1024.png` to
`icon.png` in this folder; the asset generator will derive every smaller
size from it. For best results on Android adaptive icons, also provide
`icon-foreground.png` (the Notai mark on transparent) and
`icon-background.png` (a flat `#fbfaf5` square at 1024×1024).
