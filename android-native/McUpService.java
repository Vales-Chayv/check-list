package app.mycards.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * Служба переднего плана «идёт загрузка / сжатие».
 * Пока она работает, Android не усыпляет приложение, и большие загрузки
 * продолжаются при свёрнутом экране. Никакой работы сама не делает —
 * только держит процесс живым и показывает уведомление.
 */
public class McUpService extends Service {
    static final String CH = "mc_up";
    static final int NID = 7311;
    static final String EXTRA_TEXT = "text";

    /** Запустить или обновить текст уведомления. Безопасно вызывать повторно. */
    static void start(Context ctx, String text) {
        try {
            Intent i = new Intent(ctx, McUpService.class);
            i.putExtra(EXTRA_TEXT, text == null ? "" : text);
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
            else ctx.startService(i);
        } catch (Exception e) {
            // Система не разрешила запуск (например, приложение уже в фоне) — загрузка просто идёт как раньше.
        }
    }

    static void stop(Context ctx) {
        try {
            ctx.stopService(new Intent(ctx, McUpService.class));
        } catch (Exception e) {
            // ignore
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String text = intent == null ? null : intent.getStringExtra(EXTRA_TEXT);
        if (text == null || text.length() == 0) text = "Идёт загрузка файлов";
        try {
            Notification n = build(text);
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NID, n);
            }
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    /** Android 15: лимит времени службы dataSync. Корректно завершаемся. */
    public void onTimeout(int startId, int fgsType) {
        stopForeground(true);
        stopSelf();
    }

    private Notification build(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(CH, "Загрузка файлов", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CH)
                : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.stat_sys_upload)
                .setContentTitle("Мои карточки")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) {
            int fl = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) fl |= PendingIntent.FLAG_IMMUTABLE;
            b.setContentIntent(PendingIntent.getActivity(this, 0, open, fl));
        }
        if (Build.VERSION.SDK_INT >= 31) {
            b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return b.build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
