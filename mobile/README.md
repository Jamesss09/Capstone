# Mobile — React Native (Android) Scanner

Phase 4 component: staff scan answer sheets with the phone camera.

## Current implementation

- Expo SDK 58 + React Native + TypeScript
- Android-only Expo configuration
- Expo Router with routes under `src/app/`
- Prototype-matched Staff Login screen
- Prototype-matched Scanner Home screen
- Laravel `POST /login` integration with staff-only role enforcement
- Remembered access session stored with Expo SecureStore
- The remaining capture workflow is intentionally not yet implemented; screens
  are being reviewed one at a time.

## Preview with Expo Go

1. Install **Expo Go** on an Android phone.
2. Connect the phone and development computer to the same Wi-Fi network.
3. Copy `.env.example` to `.env.local` and replace the sample address with the
   computer's LAN IPv4 address:

   ```dotenv
   EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api
   ```

4. Start Laravel/Docker on port 8000, then start Expo:

   ```powershell
   cd mobile
   npm install
   npx expo start
   ```

5. Scan the QR code in Expo Go. Changes appear through Fast Refresh.

An Android Studio emulator uses `http://10.0.2.2:8000/api`. A physical phone
cannot use `localhost` because that refers to the phone itself.

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

Android Studio is optional for Expo Go review. It is required only when running
a local Android emulator or local native build; Expo Build can create installable
builds in the cloud later.
