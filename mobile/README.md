# 📱 IIT Ropar Lost & Found — Cross-Platform Mobile App (React Native & Expo)

Cross-platform mobile client for the **IIT Ropar Lost & Found Portal** built with **React Native**, **Expo SDK 58**, and **TypeScript** for deployment on both **iOS** and **Android** devices.

---

## 🚀 Key Features

- **Dual-Mode SimpleJWT Authentication:**
  - Secure token persistence via `expo-secure-store` with automatic token refresh interceptor.
  - `@iitrpr.ac.in` domain verification with live email OTP delivery.
- **Public Feed & Discovery:**
  - Fast searchable campus feed with category filter chips and post-type toggles (All, Lost, Found).
  - High-resolution photo gallery and promised honor reward tags.
- **Native Lost & Found Reporting:**
  - Camera and photo library integration via `expo-image-picker`.
  - Confidential `hidden_proof` field for private ownership verification.
  - Custody assignment (Finder, Admin Office, Security Office).
- **Native QR Valuables Scanner:**
  - Real-time barcode & QR scanning via `expo-camera`.
  - Zero-knowledge identity protection: reveals only item name, category, and owner name without exposing phone or registration numbers.
- **Real-Time Handover Chat:**
  - Case-mediated chat threads with offline synchronization cursor (`?since=`).
  - Read receipts and unread badge counters.
- **Campus Notifications Hub:**
  - Match alerts, handover updates, and administration notifications.
- **Campus Admin Console (staff accounts only, Admin tab):**
  - Overview of pending and overdue reviews, live and returned reports, recovery rate and abuse reports.
  - Case queue with filters and full case review: approve, request info, reject, hide or restore, change category, assign, delete, with the hidden proof, the author and the audit history.
  - Match queue and handover: confirm or dismiss matches, record hidden-proof Q&A, set the meeting mode, issue and verify the one-time handover code, settle the reward and close the case.
  - Abuse reports, user moderation (ban with a reason, reinstate), admin invites, audit log, beta feedback and site settings.

---

## 🛠️ Tech Stack

- **Framework:** React Native + Expo (SDK 58)
- **Language:** TypeScript
- **Navigation:** React Navigation v7 (Native Stack & Bottom Tabs)
- **Network & State:** Axios with interceptors, Context API
- **Device Hardware APIs:**
  - `expo-camera` (`CameraView` modern QR & barcode scanning)
  - `expo-image-picker` (Camera & Photo Library)
  - `expo-secure-store` (Encrypted keychain / keystore storage)
- **Styling:** Custom light theme with IIT Ropar emerald (`#047857`) and ocean teal accents (`#0284c7`, `#0d9488`).

---

## 📲 Getting Started

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start Expo Development Server
```bash
npx expo start
```

### 3. Choose the Backend (optional)
During development the app talks to the backend on the computer running Expo
(`http://<that computer's IP>:8000/api/v1`), so start the backend with
`python manage.py runserver 0.0.0.0:8000`.

To use another server, set `EXPO_PUBLIC_API_URL` to its full API base before starting Expo
(`-c` clears the cache, which keeps the previous value otherwise):
```powershell
$env:EXPO_PUBLIC_API_URL = "https://lost-and-found-portal-zx3h.onrender.com/api/v1"; npx expo start -c
```
Release builds (an installed APK) use the hosted servers in `app.json` → `expo.extra`:
`apiUrl` (the Render backend) and `webUrl` (the Vercel web app), unless `EXPO_PUBLIC_API_URL` is set.
The Render free plan sleeps when idle, so the first request after a quiet spell can take up to a
minute; the app waits for it.

### 4. Run on Devices
- **Physical Device (iOS or Android):**
  - Download the **Expo Go** app from the App Store or Google Play.
  - Scan the terminal QR code using Expo Go (Android) or the native Camera app (iOS).
- **Android Emulator:** Press `a` in the terminal (API points to `http://10.0.2.2:8000/api/v1`).
- **iOS Simulator:** Press `i` in the terminal (API points to `http://127.0.0.1:8000/api/v1`).

---

## 🔗 Sticker Links

The app opens straight to a scan result from `lostandfound://scan/<uuid>`, and on Android from the
printed sticker URL `<web app>/scan/<uuid>` (the Vercel site; `https://lostandfound.iitrpr.ac.in` is
also listed for when the campus domain exists). Android opens those https links in the app because
the web app serves `frontend/public/.well-known/assetlinks.json` with the SHA-256 fingerprint of the
release key below. A build signed with a different key needs its fingerprint added there. In Expo Go, test with
`npx uri-scheme open "exp://<your-ip>:8081/--/scan/<uuid>" --android`.

---

## 📦 Building the Android APK locally (no Expo account)

`scripts/build-android-release.sh` builds a signed release APK connected to the hosted servers:

```bash
cd mobile
SIGNING_PROPERTIES=/path/to/keystore.properties ./scripts/build-android-release.sh
# → dist/LostAndFound-<version>.apk  (arm64-v8a + armeabi-v7a)
```

It needs Node, the Android SDK and a JDK 17+ (Android Studio provides both; on macOS the script finds
them), runs `expo prebuild --clean`, and builds with Gradle. `android/` is generated and not committed.

**Signing key.** Release builds are signed with the team's key, through the
`plugins/withReleaseSigning.js` config plugin. The key and its passwords live outside the repo in a
`keystore.properties` file:

```
storeFile=/absolute/path/lostandfound-release.jks
storePassword=...
keyAlias=lostandfound
keyPassword=...
```

Without `SIGNING_PROPERTIES` the script looks for `../../lostandfound-android-signing/keystore.properties`
next to the repo, and otherwise falls back to the debug key (fine for testing, not for sharing).
Keep the key backed up and share it only privately: every update must be signed with the same key,
or Android refuses to install it over the old version.

---

## 📦 Building Installable Apps (EAS)

Build profiles live in `eas.json`. `preview` and `production` set `EXPO_PUBLIC_API_URL` to the
deployed server; change it there if the domain differs.

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android      # APK to share with beta testers
eas build --profile production --platform android   # Play Store bundle (.aab)
eas submit --profile production --platform android  # upload to Play Console
```

The `development` profile builds a development client, which needs `npx expo install expo-dev-client`
first. It is also what push notifications will need, since Expo Go cannot receive them.
