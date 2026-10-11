// Android exports go directly to the public Downloads folder via MediaStore.
// The site is served as plain ES modules, without a JavaScript bundler.
// Capacitor's native bridge is therefore accessed through window.Capacitor.

export function isNativeApp() {
    const capacitor = globalThis.Capacitor;
    if (!capacitor) return false;
    if (typeof capacitor.isNativePlatform === 'function') {
        return capacitor.isNativePlatform();
    }
    return ['android', 'ios'].includes(capacitor.getPlatform?.());
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const splitAt = result.indexOf(',');
            if (splitAt === -1) {
                reject(new Error('Could not encode the export file.'));
                return;
            }
            resolve(result.slice(splitAt + 1));
        };
        reader.onerror = () => reject(reader.error || new Error('Could not read the export file.'));
        reader.readAsDataURL(blob);
    });
}

export async function saveNativeBlob(blob, fileName) {
    if (!isNativeApp()) {
        throw new Error('Native export is only available in the packaged app.');
    }

    const capacitor = globalThis.Capacitor;
    const safeName = String(fileName).replace(/[\\/\x00-\x1f:*?"<>|]/g, '_');
    if (!safeName || safeName === '.' || safeName === '..') {
        throw new Error('Invalid export filename.');
    }

    if (capacitor.getPlatform?.() === 'android') {
        // Android's MediaStore saves to /sdcard/Download without a share sheet.
        // The matching Java plugin MUST be registered in MainActivity.
        // Capacitor's injected Android WebView bridge populates Plugins
        // for native classes registered in MainActivity.java. The standalone
        // native bridge does not expose @capacitor/core's registerPlugin().
        const downloads = capacitor.Plugins?.OsteoMapDownloads;
        if (typeof downloads?.save !== 'function') {
            throw new Error(
                'Android Downloads plugin is not registered. Check MainActivity.java and rebuild the APK.'
            );
        }
        return await downloads.save({
            fileName: safeName,
            mimeType: String(blob.type || 'application/octet-stream').split(';')[0],
            data: await blobToBase64(blob)
        });
    }

    // Retain the existing native share route on iOS; Android never uses it.
    const filesystem = capacitor.Plugins?.Filesystem;
    const share = capacitor.Plugins?.Share;
    if (!filesystem?.writeFile || !share?.share) {
        throw new Error('Native export plugins are missing.');
    }
    const result = await filesystem.writeFile({
        path: safeName,
        data: await blobToBase64(blob),
        directory: 'CACHE'
    });
    const uri = result?.uri || (await filesystem.getUri({
        path: safeName,
        directory: 'CACHE'
    })).uri;
    if (!uri) throw new Error('Native export did not return a file URI.');
    await share.share({ files: [uri], title: `OsteoMap Export: ${safeName}` });
    return { uri };
}
