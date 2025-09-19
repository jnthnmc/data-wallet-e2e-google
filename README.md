# Data Wallet — End-to-End (Google Sign-In)

This project includes a working Google sign-in using `expo-auth-session` (Expo proxy), fetches `/userinfo`, and shows it in the app. It also contains the MVP UI.

## Run in Expo Go (dev, easiest)
1) Install deps
```
npm install
```
2) Create `.env` from `.env.example` and set:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```
(Create a Google OAuth 2.0 **Web** client in Google Cloud → Credentials.)

3) Start
```
npm start
```
Open the QR in **Expo Go** on Android → tap **Connect Google**.

## Build a downloadable APK (cloud)
```
npm install -g eas-cli
eas login
eas init --id data-wallet-e2e-google
npm run eas-build-android
```
EAS prints a link to your `.apk`.

> For a standalone APK (no proxy), add Android/iOS client IDs and switch the redirect config in `App.tsx` (covered in comments there).

