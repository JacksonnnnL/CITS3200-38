package com.cits3200.osteomaptest;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "OsteoMapDownloads")
public class OsteoMapDownloadsPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Direct Downloads saving requires Android 10 or newer.");
            return;
        }

        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String encoded = call.getString("data");

        if (fileName == null || fileName.isEmpty() || fileName.equals(".") ||
                fileName.equals("..") || !fileName.matches("[A-Za-z0-9_. -]+")) {
            call.reject("Invalid export filename.");
            return;
        }
        if (encoded == null || encoded.isEmpty()) {
            call.reject("Export file contains no data.");
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(encoded, Base64.DEFAULT);
        } catch (IllegalArgumentException ex) {
            call.reject("Invalid export encoding.");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri savedUri = null;
        try {
            Uri downloads = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            savedUri = resolver.insert(downloads, values);
            if (savedUri == null) throw new IOException("Could not create file in Downloads.");

            try (OutputStream stream = resolver.openOutputStream(savedUri, "w")) {
                if (stream == null) throw new IOException("Could not open Downloads file.");
                stream.write(bytes);
                stream.flush();
            }

            ContentValues completed = new ContentValues();
            completed.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(savedUri, completed, null, null);

            JSObject response = new JSObject();
            response.put("uri", savedUri.toString());
            response.put("directory", "Downloads");
            response.put("fileName", fileName);
            call.resolve(response);

            getActivity().runOnUiThread(() -> Toast.makeText(
                getContext(), "Saved to Downloads: " + fileName, Toast.LENGTH_LONG
            ).show());
        } catch (Exception ex) {
            if (savedUri != null) {
                try {
                    resolver.delete(savedUri, null, null);
                } catch (Exception ignored) { }
            }
            call.reject("Could not save export to Downloads: " + ex.getMessage());
        }
    }
}
