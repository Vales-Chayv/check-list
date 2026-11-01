package app.mycards.mobile;

import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** start() — включает службу «идёт запись»; stop() — выключает. Вызывать start() только когда микрофон уже разрешён. */
@CapacitorPlugin(name = "McRec")
public class McRecPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        try {
            Context ctx = getContext();
            ContextCompat.startForegroundService(ctx, new Intent(ctx, McRecService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("start failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Context ctx = getContext();
            ctx.stopService(new Intent(ctx, McRecService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("stop failed: " + e.getMessage());
        }
    }
}
