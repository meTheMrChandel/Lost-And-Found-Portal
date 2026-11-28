# 📱 IIT Ropar Lost & Found — Cross-Platform Mobile App (React Native & Expo)

Cross-platform mobile client for the **IIT Ropar Lost & Found Portal** built with **React Native**, **Expo SDK 58**, and **TypeScript** for deployment on both **iOS** and **Android** devices.

---

## 🚀 Key Features

- **Home feed:** search, an All / Lost / Found switch and category chips; photo cards with the place,
  date and any reward; infinite scroll, pull to refresh and loading placeholders.
- **Report in one tap:** the centre button of the tab bar asks "lost, found or scan?". The report
  forms take up to 5 photos (camera or gallery, shrunk before upload so they stay under the
  server's 5 MB limit), the date and time it happened, the place, private ownership proof and an
  optional reward (lost), or where the item is now and an admin-only option (found). Leaving a
  half-filled form asks before discarding it.
- **Item details:** swipeable photos, everything known about the item, "I found this" / "This is
  mine" (opens the admin office chat with a ready-made message), share, and report a listing.
- **My reports:** status filters with counts, what each status means, the admin's notes, replying
  to an information request, renewing and withdrawing.
- **Messages:** conversations with the admin office and other students, message requests by
  registration number, live chat over WebSocket with read ticks, and blocking.
- **Notifications:** grouped new and earlier, each opening the right screen (the matched item,
  the report, the conversation or the admin queue).
- **QR stickers:** register belongings, show and share the real sticker, pause or remove it, and a
  full-screen scanner with a torch. Sticker links open the scan result in the app.
- **Account:** sign in, three-step registration with an emailed code, password reset, and profile
  editing with a photo, department and programme.
- **Campus admin console (staff accounts, Admin tab):**
  - Overview of pending and overdue reviews, live and returned reports, recovery rate and abuse reports.
  - Case queue with filters and full case review: approve, request info, reject, hide or restore, change category, assign, delete, with the hidden proof, the author and the audit history.
  - Match queue and handover: confirm or dismiss matches, record hidden-proof Q&A, set the meeting mode, issue and verify the one-time handover code, settle the reward and close the case.
  - Abuse reports, user moderation (ban with a reason, reinstate), admin invites, audit log, beta feedback and site settings.

---

## 🛠️ Tech Stack

- **Framework:** React Native + Expo (SDK 58), TypeScript
- **Navigation:** React Navigation v7 (native stack and bottom tabs with a custom tab bar)
- **Network & state:** Axios with token refresh, React context for the session and unread counts
- **Device APIs:** `expo-camera` (QR scanning), `expo-image-picker` and `expo-image-manipulator`
  (photos), `expo-image` (cached images), `@react-native-community/datetimepicker`, `expo-haptics`,
  `expo-secure-store` (tokens)
- **Look:** the website's palette and its Inter typeface (`@expo-google-fonts/inter`), Lucide icons
  (`lucide-react-native` on `react-native-svg`)

## 🎨 Design System

Screens are built from the components in `src/ui/` rather than styling React Native primitives
directly, so the app stays consistent:

- `src/theme/colors.ts` and `src/theme/tokens.ts`: colours, Inter type scale, spacing, radii, shadows.
- `Text` / `TextInput`: Inter everywhere; a `fontWeight` in a style picks the matching Inter face.
- `Button`, `IconButton`, `TextField`, `SearchField`, `SelectField`, `DateTimeField`, `OtpInput`,
  `PhotoPicker`, `Chip`, `SegmentedControl`, `Badge`, `Card`, `ListItem` / `ListGroup`, `Avatar`.
- `Screen` (safe areas, keyboard handling and a pinned footer), `ScreenHeader`, `BottomSheet` /
  `OptionSheet`, `EmptyState` / `ErrorState`, `Notice`, `Skeleton`, and `useToast()` for short
  confirmations.
- `src/ui/icons.ts` imports each Lucide icon by its own file: Metro doesn't tree-shake, so importing
  from the package root would bundle all of them. Add new icons there.

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
