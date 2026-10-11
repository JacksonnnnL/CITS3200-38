import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNativeApp, saveNativeBlob } from '../www/js/nativeFileSaver.js';

afterEach(() => vi.unstubAllGlobals());

function mockFileReader() {
    vi.stubGlobal('FileReader', class {
        readAsDataURL(blob) {
            blob.arrayBuffer().then(buffer => {
                this.result = `data:${blob.type};base64,${btoa(
                    String.fromCharCode(...new Uint8Array(buffer))
                )}`;
                this.onload();
            });
        }
    });
}

describe('Native export', () => {
    it('saves CSV directly to Android Downloads without opening Share', async () => {
        mockFileReader();
        const save = vi.fn().mockResolvedValue({ directory: 'Downloads', fileName: 'result.csv' });
        const share = vi.fn();
        vi.stubGlobal('Capacitor', {
            getPlatform: () => 'android',
            isNativePlatform: () => true,
            Plugins: { OsteoMapDownloads: { save }, Share: { share } }
        });

        const result = await saveNativeBlob(new Blob(['bone,state\nFEM_R,2'], {
            type: 'text/csv;charset=utf-8'
        }), 'result.csv');

        expect(isNativeApp()).toBe(true);
        expect(save).toHaveBeenCalledWith({
            fileName: 'result.csv',
            mimeType: 'text/csv',
            data: btoa('bone,state\nFEM_R,2')
        });
        expect(result.directory).toBe('Downloads');
        expect(share).not.toHaveBeenCalled();
    });

    it('rejects an Android build without the Downloads bridge', async () => {
        vi.stubGlobal('Capacitor', {
            getPlatform: () => 'android',
            isNativePlatform: () => true
        });
        await expect(saveNativeBlob(new Blob(['x']), 'x.csv'))
            .rejects.toThrow('Android Downloads plugin is not registered');
    });

    it('passes native saving errors back to the export screen', async () => {
        mockFileReader();
        vi.stubGlobal('Capacitor', {
            getPlatform: () => 'android',
            isNativePlatform: () => true,
            Plugins: { OsteoMapDownloads: { save: vi.fn().mockRejectedValue(new Error('Storage full')) } }
        });
        await expect(saveNativeBlob(new Blob(['x']), 'x.csv'))
            .rejects.toThrow('Storage full');
    });

    it('does not use the native saver in a desktop browser', async () => {
        vi.stubGlobal('Capacitor', undefined);
        expect(isNativeApp()).toBe(false);
        await expect(saveNativeBlob(new Blob(['x']), 'test.csv'))
            .rejects.toThrow('only available in the packaged app');
    });
});
