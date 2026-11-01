package app.mycards.mobile;

import android.app.Activity;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Экран с текстом ошибки. Работает в отдельном процессе, чтобы открыться даже после падения основного. */
public class McCrashActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String trace = getIntent().getStringExtra("trace");
        if (trace == null) trace = "(нет данных)";

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFFFFFFF);
        root.setPadding(24, 48, 24, 24);

        TextView title = new TextView(this);
        title.setText("Ошибка приложения. Сделай скриншот этого экрана и пришли мне.");
        title.setTextColor(0xFFB00020);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        ScrollView sv = new ScrollView(this);
        TextView tv = new TextView(this);
        tv.setText(trace);
        tv.setTextColor(0xFF111111);
        tv.setTypeface(Typeface.MONOSPACE);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        tv.setTextIsSelectable(true);
        sv.addView(tv);
        root.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
    }
}
