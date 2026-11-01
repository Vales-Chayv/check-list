package app.mycards.mobile;

import android.content.Context;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.effect.Presentation;
import androidx.media3.transformer.DefaultEncoderFactory;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;
import androidx.media3.transformer.VideoEncoderSettings;
import androidx.media3.transformer.Composition;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.collect.ImmutableList;

import java.io.File;

/**
 * Сжатие видео перед отправкой. Файл лежит в cache-папке приложения (его туда кладёт JS через Filesystem).
 * compress({ name, maxShort, bitrate }) -> { name: "<имя>.out.mp4", size }
 */
@CapacitorPlugin(name = "McVideo")
public class McVideoPlugin extends Plugin {
    private Transformer current;
    private final Handler main = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void compress(final PluginCall call) {
        final String name = call.getString("name");
        final int maxShort = call.getInt("maxShort", 720);
        final int bitrate = call.getInt("bitrate", 2500000);
        if (name == null || name.contains("/") || name.contains("..")) { call.reject("bad name"); return; }
        final Context ctx = getContext();
        final File in = new File(ctx.getCacheDir(), name);
        final String outName = name + ".out.mp4";
        final File out = new File(ctx.getCacheDir(), outName);
        if (!in.exists()) { call.reject("no input"); return; }
        if (out.exists()) out.delete();

        // размеры и поворот исходного видео
        int w = 0, h = 0, rot = 0;
        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            mmr.setDataSource(in.getAbsolutePath());
            w = Integer.parseInt(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            h = Integer.parseInt(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            String r = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
            if (r != null) rot = Integer.parseInt(r);
        } catch (Exception e) {
            // размеры не узнали — сжимаем без изменения разрешения
        } finally {
            try { mmr.release(); } catch (Exception ignored) {}
        }
        int upW = (rot == 90 || rot == 270) ? h : w;
        int upH = (rot == 90 || rot == 270) ? w : h;
        int shortSide = Math.min(upW, upH);

        final ImmutableList.Builder<androidx.media3.common.Effect> vEffects = new ImmutableList.Builder<>();
        if (shortSide > maxShort && upW > 0 && upH > 0) {
            double k = (double) maxShort / shortSide;
            int tw = Math.max(2, ((int) Math.round(upW * k) / 2) * 2);
            int th = Math.max(2, ((int) Math.round(upH * k) / 2) * 2);
            vEffects.add(Presentation.createForWidthAndHeight(tw, th, Presentation.LAYOUT_SCALE_TO_FIT));
        }
        final Effects effects = new Effects(ImmutableList.of(), vEffects.build());

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    DefaultEncoderFactory enc = new DefaultEncoderFactory.Builder(ctx)
                            .setRequestedVideoEncoderSettings(new VideoEncoderSettings.Builder().setBitrate(bitrate).build())
                            .build();
                    current = new Transformer.Builder(ctx)
                            .setVideoMimeType(MimeTypes.VIDEO_H264)
                            .setAudioMimeType(MimeTypes.AUDIO_AAC)
                            .setEncoderFactory(enc)
                            .addListener(new Transformer.Listener() {
                                @Override
                                public void onCompleted(Composition composition, ExportResult exportResult) {
                                    current = null;
                                    JSObject res = new JSObject();
                                    res.put("name", outName);
                                    res.put("size", out.length());
                                    call.resolve(res);
                                }

                                @Override
                                public void onError(Composition composition, ExportResult exportResult, ExportException exportException) {
                                    current = null;
                                    if (out.exists()) out.delete();
                                    call.reject("transform failed: " + exportException.getMessage());
                                }
                            })
                            .build();
                    EditedMediaItem item = new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(in)))
                            .setEffects(effects)
                            .build();
                    current.start(item, out.getAbsolutePath());
                    pollProgress();
                } catch (Exception e) {
                    current = null;
                    call.reject("start failed: " + e.getMessage());
                }
            }
        });
    }

    private void pollProgress() {
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                Transformer t = current;
                if (t == null) return;
                ProgressHolder ph = new ProgressHolder();
                if (t.getProgress(ph) == Transformer.PROGRESS_STATE_AVAILABLE) {
                    JSObject o = new JSObject();
                    o.put("percent", ph.progress);
                    notifyListeners("progress", o);
                }
                main.postDelayed(this, 600);
            }
        }, 600);
    }

    @PluginMethod
    public void cancel(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try { if (current != null) current.cancel(); } catch (Exception ignored) {}
                current = null;
                call.resolve();
            }
        });
    }
}
