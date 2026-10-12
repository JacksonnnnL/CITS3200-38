## Installing OsteoMap on Android

OsteoMap is an Android app that works fully offline. It is installed from an APK file rather than from the Google Play Store, so your device needs to be told once that it is allowed to install it.

### What you need

- An Android phone or tablet running **Android 10 or newer**. The app uses a feature that saves exported files straight to your Downloads folder, which needs Android 10 or later.
- The installation file: **OsteoMap-v1.0.apk** (about 5.3 MB)
- A way to move the file to your device (USB cable, email, or a cloud-storage link). The app itself does not need an internet connection.

The app has been tested on Android phones and an Android emulator.

### Step 1: Get the installation file

The installation file, **OsteoMap-v1.0.apk**, is supplied in the project handover folder, together with a short text guide (`INSTALLATION_AND_USE.txt`). Copy the APK to your device by USB cable, email or a cloud-storage link, and save it, for example in the Downloads folder.

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
- An update only installs over the existing app if it is the **same app** (same app ID) and was **signed with the same key**. Version 1.0 is a signed release, so it does **not** install over earlier test builds. If you have an earlier test copy, remove it first (this deletes that copy's data).
- **Export your data before updating** if you can. Some updates redraw the skeleton diagrams. If the diagram's bone identifiers change, records marked on the old version can look missing on the new version, even though the data is still stored on the device.

### Removing the app

Press and hold the OsteoMap icon and choose **Uninstall**.

- **Export your data first.** Do not rely on getting it back.
- Android's automatic backup may restore some data if you reinstall later, but it runs on a delay (up to about a day) and may restore an older copy rather than your latest work.

### Troubleshooting

| Problem | What to try |
|---|---|
| "App not installed" | Free up storage. If an older copy is installed, install the new APK over it. If it still fails, the older copy was signed with a different key or has a different app ID (for example an earlier test build). Export your data, uninstall the old copy, then install the new one. Uninstalling removes the app's data. For a future update to the client's own copy, do not uninstall to fix this. Rebuild using the same app ID and signing key instead. |
| Export says it failed, or no file appears | Export saves to the **Downloads** folder and needs Android 10 or newer. On Android 9 or older the export shows an error message. |
| The Install button is greyed out or blocked | Repeat Step 2 and make sure permission is on for the app you opened the file from. |
| Google Play Protect warning | Choose **Install anyway**. |
| Marked bones seem to have disappeared after an update | Records are stored under the diagram's bone identifiers. If they changed between versions, the old records are not shown. Contact the project team before deleting any data. |

---

## Building the app from source (developer notes)

This section is for developers who need to rebuild the APK. Place it with the technical section of the README, not in the client-facing guide.

OsteoMap is a web app in `www/` packaged for Android with Capacitor and Gradle.

### Prerequisites

- **Node.js** and **npm**
- **JDK 21**, for example from Adoptium, or the JDK bundled with Android Studio
- **Android Studio**, for the Android SDK and build tools
- **PowerShell** (included with Windows)

Set these once:

- `JAVA_HOME` pointing to JDK 21, for example `C:\Program Files\Java\jdk-21.0.11`
- The Android SDK path, normally `C:\Users\<you>\AppData\Local\Android\Sdk`

### Part 1: Setup (once per machine)

From the project folder:

```powershell
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init OsteoMap com.cits3200.osteomaptest www
type capacitor.config.json
npx cap add android
npx cap sync
```

`capacitor.config.json` should show `appId` = `com.cits3200.osteomaptest`, `appName` = `OsteoMap` and `webDir` = `www`.

The delivered v1.0 APK uses the app ID `com.cits3200.osteomaptest`. To build an update that installs over v1.0, keep this same app ID and sign it with the same key as v1.0. A different app ID installs as a separate app with separate data.

Then open `android/app/build.gradle` and set the version:

```gradle
versionCode <a number higher than the installed build>
versionName "1.0"
```

Increase `versionCode` for every new build. Android only installs a build over an existing one if its `versionCode` is higher.

### Part 1b: Add the Downloads plugin and the app icon (required)

The repository does not contain the generated `android/` project, so two pieces must be added by hand. Full notes are in `native-android/SETUP.txt`. Without the plugin, **Export does not work in the app**: it shows "Android Downloads plugin is not registered".

1. Copy `native-android/OsteoMapDownloadsPlugin.java` into the same folder as `MainActivity.java` (`android/app/src/main/java/.../`). Its first line, `package com.cits3200.osteomaptest;`, must match the app ID.
2. Register it in `MainActivity.java`, before `super.onCreate(...)`:

```java
@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(OsteoMapDownloadsPlugin.class);
    super.onCreate(savedInstanceState);
}
```

You may need `import android.os.Bundle;`. Keep the existing `MainActivity` code.

3. Copy the contents of `native-android/launcher-res/res/` into `android/app/src/main/res/`, merging folders and overwriting the default `ic_launcher` files. This installs the OsteoMap launcher icon. `npx cap sync` does not copy these.
4. Run `npx cap sync android`, then rebuild (syncing alone does not rebuild).

### Part 2: Build the APK

In PowerShell, from the project folder:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.11"

# Write the SDK path (once per machine). Use your own path.
"sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk" | Out-File -Encoding ASCII android\local.properties

cd android
.\gradlew assembleDebug
cd ..

copy android\app\build\outputs\apk\debug\app-debug.apk OsteoMap-v1.0.apk
```

The file name is only a label. Android reads the real name and version from inside the APK.

`assembleDebug` produces a debug-signed build, which is fine for testing. The delivered v1.0 APK is a signed release build. A release build needs a signing configuration and a keystore, which are **not** in the repository and must be kept safe by the release owner (never commit them). Android only allows an update over an installed app if both builds are signed with the same key, so losing the keystore means future updates cannot install over v1.0.

### Rebuilding after a code change

```powershell
npx cap sync
cd android
.\gradlew assembleDebug
cd ..
copy android\app\build\outputs\apk\debug\app-debug.apk OsteoMap-v1.0.apk
```

`npx cap sync` copies the latest `www/` files into the Android project. If you skip it, the APK keeps the old web files.

### Common build errors

| Error | Cause | Fix |
|---|---|---|
| `SDK location not found` | `local.properties` is missing or wrong | Re-run the `sdk.dir=...` line above |
| `invalid source release: 21` | The wrong JDK is in use | Set `$env:JAVA_HOME` to JDK 21 in the same terminal |
| `PathNotFound` on `copy` | You are inside `android\` but the path starts with `android\app\...` | Run `cd ..` first, then copy |
| `App not installed` on the phone | The signing key does not match the installed app | Build on the machine that made the original APK, or copy `~\.android\debug.keystore` across |
| APK is only a few hundred KB | `www/` was empty at sync time | Check `www/index.html` exists, then run `npx cap sync` again |

### Notes

- `android/local.properties` holds the SDK path for one machine only and must not be committed. Capacitor's `.gitignore` normally ignores it. To check: `type .gitignore | Select-String "local.properties"`. If nothing prints, add `android/local.properties` to `.gitignore`.
- The app ID is `com.cits3200.osteomaptest`. Installing over an existing copy only keeps data if the app ID and signing key are unchanged and `versionCode` is higher.
- **After an update:** installing over the same app keeps the data. Uninstalling and reinstalling may bring back an older automatic backup. If the SVG bone ids changed between versions, older bone records are still stored but are not shown.
- The app can be installed on Android 7.0 (API 24) and newer, and targets API 36. **Export needs Android 10 or newer**, because the Downloads plugin uses Android 10's storage API.
- Exports are separate files (a `.csv` and a `.jpg`), with CSV state codes 0 = absent, 1 = present, 2 = fragmented.
- The app has no import or restore function. Uninstalling or clearing the app's storage permanently removes editable records.
- The build is only repeatable from the repository once it contains `www/`, `android/`, `package.json`, `package-lock.json` and `capacitor.config.json`.
- Run `npm test` before building to confirm the test suite passes.
