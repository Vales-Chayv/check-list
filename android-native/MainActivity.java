package app.mycards.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(McVideoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
