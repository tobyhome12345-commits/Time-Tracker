# 🌱 Touch Grass

Get outside, win XP, grow **Pip the sprout** 🌱. Touch Grass tracks your **outdoor time**. Beat your daily target and Pip levels up; miss it and you lose XP (and Pip can shrink!).

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

- [ ] Log a quick **15m** and watch the ring move toward today's target.
- [ ] Start the **outside timer**, close the app, reopen it: the timer is still running.
- [ ] *Settings → Holiday mode*: add your next school holiday.
- [ ] *Settings → Your data → Export* to save a backup (to Drive, Files, etc.).
- [ ] After an update: check your logs are still there.

## ✨ Features

**🎯 Daily targets:** 📚 school days **1h**, 🎉 weekends **2h**, 🏖️ holidays **2h every day** (all adjustable).

**⭐ XP you can win and lose**
| | XP |
|---|---|
| Hit your target | **+25** |
| Every extra minute (up to 4h) | **+1** |
| Streak bonus | **+5 per streak day** (max +25) |
| Weekend challenge complete | **+50** |
| Miss your target | **−1 per minute short** (applied at midnight) |
| 😴 Rest day (1 per week) | ±0, streak safe |

XP never goes below 0. Levels (and Pip's stage, Seed → Mighty Tree 😎) go **up and down**.

- **Today:** a day-type chip, a progress ring toward today's target, live XP (earned, or "−20 XP at risk tonight"), quick logging (15m, 30m, 1h, 2h or custom, with 8 activities, notes and past days), and an outside timer.
- **Pip:** 6 growth stages and 6 moods (sleepy, happy, cheering, worried after 5pm, droopy after losing XP, resting), plus holiday sunglasses.
- **📜 XP history:** every day's +/− XP and why, weekly totals, and level-up/down markers.
- **🏖️ Holiday mode:** add holiday periods (name + dates) and every day in them gets the holiday target.
- **🏆 Weekend challenges:** a new one each week, and only weekends and holiday days count. No pressure on school days.
- **📊 Stats:** a week chart with target markers and XP, a 📅 month calendar, and insights (hit rate, school days vs weekends, best day and week, longest outing, top activities).
- **20 badges:** Perfect Week, Holiday Hero, Comeback Kid, Challenge Champ and more.
- **Settings:** targets, holidays, light / dark / system theme, an accent colour, and JSON backup export and import.
- **No notifications, no accounts, no ads**, 100% offline.

## 🛠 How it's built

| | |
|---|---|
| App | React 19 + TypeScript + Vite, hand-made SVG charts and mascot |
| Android | Capacitor 8 (`com.touchgrass.tracker`), edge-to-edge |
| Storage | One JSON blob in Android SharedPreferences (`@capacitor/preferences`) |
| CI/CD | `.github/workflows/android.yml`: test → build → sign → GitHub Release, on **every push** |

```bash
npm install
npm run dev          # run in a browser
npm test             # unit tests (XP rules, day types, challenges, streaks, badges, stats, migration, backup)
npm run build        # type-check + production web build
npx cap sync android # copy the web build into the Android project
```

Each CI build gets `versionCode` = minutes since 2024-01-01, so the number only ever goes up and every APK installs as an update. Releases are named `v1.0.<build number>`; the newest is marked **Latest**, and only the newest 15 are kept.

## 🔑 Signing key: do not touch

`android/app/release.keystore` + `android/keystore.properties` sign every build with the **same key**, which is what lets updates install over the old app and keep your data. (They're committed on purpose so builds need zero setup. Only install the app from your own link above.)

**Never regenerate or replace the key.** A new key forces an uninstall, which wipes the app's data. If you ever must, use *Settings → Your data → Export* first, then *Import* after reinstalling.
