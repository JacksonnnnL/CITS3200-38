## Installing OsteoMap on Android

OsteoMap is an Android app that works fully offline. It is installed from an APK file rather than from the Google Play Store, so your device needs to be told once that it is allowed to install it.

### What you need

- An Android phone or tablet running **Android 7.0 or newer**
- The installation file: **OsteoMap-v0.5.apk** (about 4.5 MB)
- An internet connection only to download the file. The app itself does not need one.

The app has been tested on a Samsung Galaxy A55 5G.

### Step 1: Get the installation file

[TODO: how the client receives the file, e.g. download link / USB transfer / shared folder]

Save **OsteoMap-v0.5.apk** to your device, for example in the Downloads folder.

### Step 2: Allow installation from this source

Because the app does not come from the Play Store, Android asks for permission the first time.

1. Open the APK file from your Downloads folder (use the **Files** app).
2. If Android says the installation is blocked, tap **Settings**.
3. Turn on **Allow from this source** for the app you opened the file with (for example Files or Chrome).
4. Go back and tap **Install**.

Menu names differ slightly between Android versions and manufacturers. Look for "Install unknown apps".

### Step 3: Install and open

1. Tap **Install**. If Google Play Protect warns about an unrecognised app, choose **Install anyway**. The app comes directly from the project team.
2. When it finishes, tap **Open**, or find **OsteoMap** in your app list.

You should see the OsteoMap home screen, where you create and select sites. To confirm offline use, switch on airplane mode and check the app still opens.

### Updating the app

To install a newer version, open the new APK and tap **Install**. Install it over the existing app. Do not uninstall first.

- Your saved sites, individuals and bone records are **kept** when you update this way.
- **Export your data before updating** if you can. Some updates redraw the skeleton diagrams. If the diagram's bone identifiers change, records marked on the old version can look missing on the new version, even though the data is still stored on the device.

### Removing the app

Press and hold the OsteoMap icon and choose **Uninstall**.

- **Export your data first.** Do not rely on getting it back.
- Android's automatic backup may restore some data if you reinstall later, but it runs on a delay (up to about a day) and may restore an older copy rather than your latest work.

### Troubleshooting

| Problem | What to try |
|---|---|
| "App not installed" | Free up storage. If an older copy is installed, install the new APK over it. |
| The Install button is greyed out or blocked | Repeat Step 2 and make sure permission is on for the app you opened the file from. |
| Google Play Protect warning | Choose **Install anyway**. |
| Marked bones seem to have disappeared after an update | Records are stored under the diagram's bone identifiers. If they changed between versions, the old records are not shown. Contact the project team before deleting any data. |

---

## Building the app from source (developer notes)

This section is for developers who need to rebuild the APK. Place it with the technical section of the README, not in the client-facing guide.

OsteoMap is a web app in `www/` packaged for Android with Capacitor and Gradle.

### Prerequisites

- Node.js and npm
- JDK 21, with `JAVA_HOME` set to it
- Android Studio, with the Android SDK installed

### Build steps

From the project root:

```powershell
npm install
npx cap sync
cd android
.\gradlew assembleDebug
cd ..
```

The APK is produced at `android/app/build/outputs/apk/debug/app-debug.apk`. Rename it (for example to `OsteoMap-v0.5.apk`) before distributing.

### First-time setup (only if `android/` and `capacitor.config.json` are not already in the repo)

```powershell
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init OsteoMap com.cits3200.osteomap --web-dir www
npx cap add android
```

Then run the build steps above.

### Notes

- The build is repeatable from the repo as long as it contains `www/`, `android/`, `package.json`, `package-lock.json` and `capacitor.config.json`.
- The app ID is `com.cits3200.osteomap`. Installing over an existing copy only keeps data if the app ID is unchanged.
- Minimum supported Android is 7.0 (API 24). The target is API 36.
- The output is a debug build.
- Run `npm test` before building to confirm the test suite passes.
