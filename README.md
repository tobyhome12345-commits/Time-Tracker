# 🌱 Touch Grass

Track your **inside (screen) time vs outside time**, with streaks, badges, charts, reminders and **Pip the sprout**, who grows the more you get outside.

Works 100% offline. Everything is saved on your phone.

## 📲 Install on Android

**Forever download link (always the newest version):**

https://github.com/tobyhome12345-commits/Time-Tracker/releases/latest/download/TouchGrass.apk

1. Open the link on your phone and download `TouchGrass.apk`.
2. Tap the download. If Android says *"For your security, your phone is not allowed to install unknown apps from this source"*, tap **Settings** → turn on **Allow from this source** → go back.
3. Tap **Install**. If Play Protect warns about an unknown app, tap **More details → Install anyway**.
4. Open **Touch Grass** 🌱

**Updating:** just download and install from the same link again. Tap **Update**; your data stays.

## 🛠 How it's built

- React + TypeScript + Vite web app, wrapped as a native Android app with **Capacitor 8**.
- Data: one JSON blob in Android SharedPreferences (`@capacitor/preferences`).
- Reminders: real OS-scheduled notifications (`@capacitor/local-notifications`).
- **GitHub Actions** (`.github/workflows/android.yml`) builds, tests, signs and publishes a Release on **every push**.

```bash
npm install
npm run dev        # run in a browser
npm test           # unit tests
npm run build      # production web build
npx cap sync android
```

## 🔑 Signing key: do not touch

`android/app/release.keystore` + `android/keystore.properties` sign every build with the **same key**, which is what lets updates install over the old app and keep your data.
**Never regenerate or replace it.** A new key forces an uninstall (which wipes data). If you ever must, export a backup in *Settings → Data* first, then import it after reinstalling.
