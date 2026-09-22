# Mobile — React Native (Android) Scanner

Phase 4 component: staff scan answer sheets with the phone camera.

## Planned screens (see `obsidian/UI Prototypes.md`)
- Staff Login
- Home Scanner
- Scan Answer Sheet (capture + preview)
- Identify Applicant
- Processing / status
- Order (flow guide)
- View Result

## Environment requirement
This machine does **not** yet have the **Android SDK** (`ANDROID_HOME` unset).
Before scaffolding:

```powershell
# Install Android Studio (or command-line tools), then set:
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
# verify
adb --version
```

## Fast path
Use Expo for fast start, eject to bare RN later if needed:
```bash
npx create-expo-app mobile --template blank-typescript
```

> Kicked off in **Phase 4** after backend + OMR integration points exist.