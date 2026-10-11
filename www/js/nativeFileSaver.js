
import {
    Filesystem,
    Directory
} from '@capacitor/filesystem';

import {
    Share
} from '@capacitor/share';

// Convert a generated Blob to Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const dataUrl = String(reader.result);
            resolve(dataUrl.split(',')[1]);
        };

        reader.onerror = () => reject(reader.error);

        reader.readAsDataURL(blob);
    });
}

// Write file locally and open Android share dialog
export async function saveNativeBlob(blob, fileName) {

    const base64 = await blobToBase64(blob);

    const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache
    });

    await Share.share({
        title: 'OsteoMap Export',
        files: [result.uri],
        dialogTitle: 'Save or share export'
    });
}