package app.mycards.mobile;

import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * McScreen — запись экрана телефона.
 *  start({audio})  — спрашивает разрешение у системы и начинает запись;
 *  stop()          — останавливает, возвращает {name, path, size, ms, audio};
 *  status()        — идёт ли запись / последний результат;
 *  discard({name}) — удалить файл записи из кэша.
 * Если запись остановили снаружи (кнопка в шторке, системная плашка) —
 * приходит событие "finished" с тем же результатом.
 */
@CapacitorPlugin(name = "McScreen")
public class McScreenPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall pending;
    private Runnable timeout;
    private boolean wantAudio;

    @Override
    public void load() {
        McScreenService.listener = new McScreenService.Listener() {
            @Override
            public void onStarted(boolean audio) {
                final boolean a = audio;
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        PluginCall c = takePending();
                        if (c != null) {
                            JSObject r = new JSObject();
                            r.put("started", true);
                            r.put("audio", a);
                            c.resolve(r);
                        }
                    }
                });
            }

            @Override
            public void onFinished(final McScreenService.Result res) {
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        PluginCall c = takePending();
                        if (c != null) {
                            c.reject(res.err == null ? "Запись не началась" : res.err);
                            return;
                        }
                        notifyListeners("finished", toJs(res));
                    }
                });
            }
        };
    }

    private PluginCall takePending() {
        PluginCall c = pending;
        pending = null;
        if (timeout != null) {
            main.removeCallbacks(timeout);
            timeout = null;
        }
        return c;
    }

    private static JSObject toJs(McScreenService.Result r) {
        JSObject o = new JSObject();
        if (r == null) return o;
        if (r.name != null) {
            o.put("name", r.name);
            o.put("path", r.path);
        }
        o.put("size", r.size);
        o.put("ms", r.ms);
        o.put("audio", r.audio);
        if (r.err != null) o.put("error", r.err);
        return o;
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT < 21) {
            call.reject("Запись экрана недоступна на этой версии Android");
            return;
        }
        if (McScreenService.inst != null || pending != null) {
            call.reject("Запись уже идёт");
            return;
        }
        wantAudio = Boolean.TRUE.equals(call.getBoolean("audio", false));
        MediaProjectionManager mpm = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("Запись экрана недоступна");
            return;
        }
        startActivityForResult(call, mpm.createScreenCaptureIntent(), "onScreenAllowed");
    }

    @ActivityCallback
    private void onScreenAllowed(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result == null ? null : result.getData();
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || data == null) {
            JSObject r = new JSObject();
            r.put("started", false);
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        pending = call;
        timeout = new Runnable() {
            @Override
            public void run() {
                PluginCall c = takePending();
                if (c != null) c.reject("Запись не запустилась вовремя");
            }
        };
        main.postDelayed(timeout, 10000);
        try {
            Intent i = new Intent(getContext(), McScreenService.class);
            i.putExtra("code", result.getResultCode());
            i.putExtra("data", data);
            i.putExtra("audio", wantAudio);
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
        } catch (Exception e) {
            PluginCall c = takePending();
            if (c != null) c.reject("Не удалось запустить запись");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        McScreenService s = McScreenService.inst;
        if (s == null) {
            McScreenService.Result l = McScreenService.last;
            if (l != null && l.name != null) {
                call.resolve(toJs(l));
            } else {
                call.reject("Запись не идёт");
            }
            return;
        }
        McScreenService.Result r = s.finish(null);
        call.resolve(toJs(r));
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        o.put("recording", McScreenService.inst != null);
        McScreenService.Result l = McScreenService.last;
        if (l != null && l.name != null) o.put("last", toJs(l));
        call.resolve(o);
    }

    @PluginMethod
    public void discard(PluginCall call) {
        String n = call.getString("name");
        if (n != null && n.startsWith("mc-screen-") && n.endsWith(".mp4")
                && !n.contains("/") && !n.contains("\\") && !n.contains("..")) {
            File f = new File(getContext().getCacheDir(), n);
            if (f.isFile()) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
            McScreenService.Result l = McScreenService.last;
            if (l != null && n.equals(l.name)) McScreenService.last = null;
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        McScreenService.listener = null;
        super.handleOnDestroy();
    }
}
