package app.mycards.mobile;

import android.app.Application;
import android.content.Context;
import android.content.Intent;
import android.os.Process;

import java.io.PrintWriter;
import java.io.StringWriter;

/** При аварийном вылете показывает экран с текстом ошибки (вместо молчаливого закрытия). */
public class McApp extends Application {
    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        final Context app = this;
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                try {
                    StringWriter sw = new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    String trace = sw.toString();
                    if (trace.length() > 7000) trace = trace.substring(0, 7000);
                    Intent i = new Intent(app, McCrashActivity.class);
                    i.putExtra("trace", "Поток: " + t.getName() + "\n\n" + trace);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    app.startActivity(i);
                    Thread.sleep(400);
                } catch (Throwable ignored) {
                }
                Process.killProcess(Process.myPid());
                System.exit(10);
            }
        });
    }
}
