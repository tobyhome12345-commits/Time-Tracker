# 🌱 Touch Grass

Track your **inside (screen) time vs outside time**, with charts, streaks, badges, reminders and **Pip the sprout**, a little buddy who grows the more you get outside.

Works 100% offline. Everything is saved on your phone.

## 📲 Install on Android

**Forever download link (always the newest version):**

### 👉 https://github.com/tobyhome12345-commits/Time-Tracker/releases/latest/download/TouchGrass.apk

1. Open the link above **on your Android phone**. `TouchGrass.apk` starts downloading (about 5 MB).
2. When it finishes, tap **Open** in the download notification, or open **Files → Downloads → TouchGrass.apk**.
3. If Android says *"For your security, your phone is not allowed to install unknown apps from this source"*:
   tap **Settings** → switch on **Allow from this source** → tap **Back**.
4. Tap **Install**. If **Play Protect** pops up, tap **More details → Install anyway**.
   (It only warns because the app isn't from the Play Store.)
5. Tap **Open**. Say hi to Pip 🌱

### 🔄 Updating

Every change pushed to this repo builds a new version automatically. To update, open the **same link** again, download, and tap **Update**. Your logs, streaks and Pip's level are kept.

### ✅ First-run checklist

- [ ] Log a quick **Outside 15m** and check the ring and goal bar move.
- [ ] *Settings → Reminders*: switch on **Daily reminder**, tap **Allow** when Android asks, then tap **Send a test notification**. You should see "Hi from Pip!" within a few seconds.
- [ ] Start an **Outside timer**, close the app, reopen it: the timer is still running, and there's a "timer running" notification.
- [ ] *Settings → Your data → Export* to save a backup (to Drive, Files, etc.).
- [ ] Later, after an update: check your logs are still there.

## ✨ Features

- **Quick logging:** Inside / Outside buttons, presets (15m, 30m, 1h, 2h), custom hours + minutes, categories (gaming, YouTube, schoolwork, TV / scooting, sport, walking, hanging out), notes, and logging for past days. Edit or delete anything, with Undo.
- **Live timer:** start and stop; it saves the log for you and survives closing the app.
- **Today:** a big outside-vs-inside ring, totals, goal + limit progress bars, and the day's logs.
- **Stats:** week and month charts, outside %, change vs the previous period, and Insights (best day, daily averages, top activities, most outdoorsy weekday, time of day).
- **Pip:** 6 growth stages (Seed → Mighty Tree 😎) and 5 moods that react to your balance. XP = outside minutes + a bonus for goal days.
- **Streaks and badges:** "outside wins" and "goal hit" streaks, plus 16 milestone badges.
- **Reminders:** an optional daily reminder, and fresh-air nudges after too long inside. Android schedules them itself (they work with the app closed), with quiet hours 9pm–8am.
- **Settings:** light / dark / system theme, an accent colour picker, and JSON backup export + import.

## 🛠 How it's built

| | |
|---|---|
| App | React 19 + TypeScript + Vite, hand-made SVG charts and mascot |
| Android | Capacitor 8 (`com.touchgrass.tracker`), edge-to-edge |
| Storage | One JSON blob in Android SharedPreferences (`@capacitor/preferences`) |
| Notifications | `@capacitor/local-notifications` (Android AlarmManager) |
| CI/CD | `.github/workflows/android.yml`: test → build → sign → GitHub Release, on **every push** |

```bash
npm install
npm run dev          # run in a browser
npm test             # unit tests (time maths, stats, streaks, badges, backup, notification rules)
npm run build        # type-check + production web build
npx cap sync android # copy the web build into the Android project
```

Each CI build gets `versionCode` = minutes since 2024-01-01, so the number only ever goes up and every APK installs as an update. Releases are named `v1.0.<build number>`; the newest is marked **Latest**, and only the newest 15 are kept.

## 🔑 Signing key: do not touch

`android/app/release.keystore` + `android/keystore.properties` sign every build with the **same key**, which is what lets updates install over the old app and keep your data. (They're committed on purpose so builds need zero setup. Only install the app from your own link above.)

**Never regenerate or replace the key.** A new key forces an uninstall, which wipes the app's data. If you ever must, use *Settings → Your data → Export* first, then *Import* after reinstalling.
