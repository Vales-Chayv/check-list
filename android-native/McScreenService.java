package app.mycards.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import java.io.File;

/**
 * Запись экрана телефона (видео + по желанию микрофон) в mp4 в кэше приложения.
 * Работает как служба переднего плана (требование Android для MediaProjection).
 * Управляется из McScreenPlugin.
 */
public class McScreenService extends Service {
    static final String CH = "mc_screen";
    static final int NID = 7312;
    static final String ACT_STOP = "app.mycards.mobile.SCREEN_STOP";

    /** Итог записи. */
    static class Result {
        String name;
        String path;
        long size;
        long ms;
        boolean audio;
        String err;
    }

    interface Listener {
        void onStarted(boolean audio);

        void onFinished(Result r);
    }

    static volatile Listener listener;
    static volatile McScreenService inst;
    static volatile Result last;

    private final Handler main = new Handler(Looper.getMainLooper());
    private MediaProjection proj;
    private MediaProjection.Callback projCb;
    private VirtualDisplay vd;
    private MediaRecorder rec;
    private File out;
    private long t0;
    private boolean audio;
    private boolean running;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACT_STOP.equals(intent.getAction())) {
            finish(null);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (running || intent == null) {
            if (!running) stopSelf();
            return START_NOT_STICKY;
        }
        int code = intent.getIntExtra("code", 0);
        Intent data = intent.getParcelableExtra("data");
        boolean wantAudio = intent.getBooleanExtra("audio", false);
        if (wantAudio && Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            wantAudio = false;
        }
        // 1) сначала служба переднего плана — иначе Android 14 не даст получить проекцию
        try {
            Notification n = notification();
            if (Build.VERSION.SDK_INT >= 30) {
                int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
                if (wantAudio) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                startForeground(NID, n, type);
            } else if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(NID, n);
            }
        } catch (Exception e) {
            fail("Не удалось запустить запись: " + msg(e));
            return START_NOT_STICKY;
        }
        // 2) проекция, рекордер, виртуальный экран
        try {
            inst = this;
            MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (mpm == null || data == null) throw new IllegalStateException("нет разрешения на запись экрана");
            proj = mpm.getMediaProjection(code, data);
            if (proj == null) throw new IllegalStateException("система не выдала доступ к экрану");
            projCb = new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    main.post(new Runnable() {
                        @Override
                        public void run() {
                            finish(null);
                        }
                    });
                }
            };
            proj.registerCallback(projCb, main);

            DisplayMetrics dm = new DisplayMetrics();
            WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
            if (wm != null) wm.getDefaultDisplay().getRealMetrics(dm);
            if (dm.widthPixels <= 0 || dm.heightPixels <= 0) dm = getResources().getDisplayMetrics();
            int w = dm.widthPixels, h = dm.heightPixels;
            int mx = Math.max(w, h);
            if (mx > 1280) {
                float k = 1280f / mx;
                w = (int) (w * k);
                h = (int) (h * k);
            }
            w = Math.max(16, (w / 16) * 16);
            h = Math.max(16, (h / 16) * 16);

            out = new File(getCacheDir(), "mc-screen-" + System.currentTimeMillis() + ".mp4");
            rec = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(this) : new MediaRecorder();
            if (wantAudio) rec.setAudioSource(MediaRecorder.AudioSource.MIC);
            rec.setVideoSource(MediaRecorder.VideoSource.SURFACE);
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            rec.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
            if (wantAudio) {
                rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
                rec.setAudioEncodingBitRate(128000);
                rec.setAudioSamplingRate(44100);
            }
            rec.setVideoSize(w, h);
            rec.setVideoFrameRate(30);
            rec.setVideoEncodingBitRate(4000000);
            rec.setOutputFile(out.getAbsolutePath());
            rec.prepare();

            vd = proj.createVirtualDisplay("mc-screen", w, h, dm.densityDpi,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, rec.getSurface(), null, null);
            if (vd == null) throw new IllegalStateException("не удалось создать виртуальный экран");
            rec.start();
            audio = wantAudio;
            t0 = System.currentTimeMillis();
            running = true;
            last = null;
        } catch (Exception e) {
            fail("Не удалось начать запись: " + msg(e));
            return START_NOT_STICKY;
        }
        Listener l = listener;
        if (l != null) l.onStarted(audio);
        return START_NOT_STICKY;
    }

    /** Останавливает запись; результат уходит слушателю и возвращается. */
    synchronized Result finish(String error) {
        if (!running && error == null) {
            return last;
        }
        boolean was = running;
        running = false;
        Result r = new Result();
        r.audio = audio;
        r.err = error;
        if (was) {
            try {
                if (rec != null) rec.stop();
            } catch (Exception e) {
                if (r.err == null) r.err = "Запись слишком короткая";
            }
        }
        cleanup();
        if (out != null) {
            r.name = out.getName();
            r.path = out.getAbsolutePath();
            r.size = out.length();
            r.ms = t0 > 0 ? System.currentTimeMillis() - t0 : 0;
            if (r.size < 1024) {
                // пустой файл не нужен
                //noinspection ResultOfMethodCallIgnored
                out.delete();
                r.name = null;
                r.path = null;
                r.size = 0;
                if (r.err == null) r.err = "Запись пустая";
            }
        }
        last = r;
        inst = null;
        try {
            stopForeground(true);
        } catch (Exception e) {
            // ignore
        }
        stopSelf();
        Listener l = listener;
        if (l != null) l.onFinished(r);
        return r;
    }

    private void fail(String err) {
        running = false;
        Result r = new Result();
        r.err = err;
        cleanup();
        if (out != null && out.exists()) {
            //noinspection ResultOfMethodCallIgnored
            out.delete();
        }
        last = r;
        inst = null;
        try {
            stopForeground(true);
        } catch (Exception e) {
            // ignore
        }
        stopSelf();
        Listener l = listener;
        if (l != null) l.onFinished(r);
    }

    private void cleanup() {
        try {
            if (vd != null) vd.release();
        } catch (Exception e) {
            // ignore
        }
        vd = null;
        try {
            if (rec != null) {
                rec.reset();
                rec.release();
            }
        } catch (Exception e) {
            // ignore
        }
        rec = null;
        try {
            if (proj != null) {
                if (projCb != null) proj.unregisterCallback(projCb);
                proj.stop();
            }
        } catch (Exception e) {
            // ignore
        }
        proj = null;
        projCb = null;
    }

    private Notification notification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(CH, "Запись экрана", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CH)
                : new Notification.Builder(this);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) fl |= PendingIntent.FLAG_IMMUTABLE;
        Intent stop = new Intent(this, McScreenService.class);
        stop.setAction(ACT_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, fl);
        b.setSmallIcon(android.R.drawable.presence_video_online)
                .setContentTitle("Мои карточки")
                .setContentText("Идёт запись экрана")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_media_pause, "Остановить", stopPi);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) {
            b.setContentIntent(PendingIntent.getActivity(this, 0, open, fl));
        }
        if (Build.VERSION.SDK_INT >= 31) {
            b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return b.build();
    }

    private static String msg(Exception e) {
        String m = e.getMessage();
        return m == null || m.length() == 0 ? e.getClass().getSimpleName() : m;
    }

    @Override
    public void onDestroy() {
        if (running) finish(null);
        inst = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
