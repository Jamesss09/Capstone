# Mobile — React Native (Android) Scanner

Phase 4 component: staff scan answer sheets with the phone camera.

## OMR integration boundary

The verified `.pt` checkpoint remains in the Python service; it is **not**
bundled into Android. The mobile app captures a JPEG/PNG and uploads it to
Laravel (`POST /sheets/upload`), then polls `GET /omr-jobs/{job}`. Laravel's
worker serializes the applicant's automatically bound answer key and calls the private
Python `POST /recognize` endpoint. That endpoint now performs all 410 bubble
classifications, 100 item decisions, and scoring. Laravel independently checks
the response and atomically persists all answers, flags, diagnostics, and the
result. The mobile app never uploads or selects an answer key.

## Planned screens (see `obsidian/UI Prototypes.md`)
- Staff Login
- Home Scanner
- Scan Answer Sheet (capture + preview)
- Identify Applicant — sends `course` (**required**, e.g. `BSIT`) and `student_type` (`NEW` / `TRANSFEREE` / `OLD` / `RETURNEE`) to `POST /applicants`; Laravel returns the generated applicant ID and automatically binds the active key
- Processing / status — poll the returned OMR job; show `error_message` and allow a new capture when status is `Failed`
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
