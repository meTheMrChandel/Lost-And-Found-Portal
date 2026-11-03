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

To use another server, set `EXPO_PUBLIC_API_URL` to its full API base before starting Expo:
```powershell
$env:EXPO_PUBLIC_API_URL = "https://lostandfound.iitrpr.ac.in/api/v1"; npx expo start -c
```
Release builds get it from the build profile in `eas.json` (see below).

### 4. Run on Devices
- **Physical Device (iOS or Android):**
  - Download the **Expo Go** app from the App Store or Google Play.
  - Scan the terminal QR code using Expo Go (Android) or the native Camera app (iOS).
- **Android Emulator:** Press `a` in the terminal (API points to `http://10.0.2.2:8000/api/v1`).
- **iOS Simulator:** Press `i` in the terminal (API points to `http://127.0.0.1:8000/api/v1`).

---

## 🔗 Sticker Links

The app opens straight to a scan result from `lostandfound://scan/<uuid>`, and on Android from the
printed sticker URL `https://lostandfound.iitrpr.ac.in/scan/<uuid>`. For Android to open those https
links without asking, the server must serve `/.well-known/assetlinks.json` with the app's signing
certificate fingerprint (shown by `eas credentials`). In Expo Go, test with
`npx uri-scheme open "exp://<your-ip>:8081/--/scan/<uuid>" --android`.

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
