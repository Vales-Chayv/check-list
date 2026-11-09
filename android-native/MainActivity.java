package app.mycards.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(McVideoPlugin.class);
        registerPlugin(McRecPlugin.class);
        registerPlugin(McSysPlugin.class);
        registerPlugin(McScreenPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
