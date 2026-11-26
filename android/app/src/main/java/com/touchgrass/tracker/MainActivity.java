package com.touchgrass.tracker;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // IMPORTANT: super.onCreate() must run first. BridgeActivity swaps the splash (launch) theme for
        // AppTheme.NoActionBar inside it; touching the window before that builds it with the splash theme,
        // which adds a native title bar ("Touch Grass" + stretched splash image) over the app.
        super.onCreate(savedInstanceState);
        // Draw behind the status + navigation bars on every Android version; the web app pads itself
        // using the safe-area insets Capacitor's SystemBars injects.
        EdgeToEdge.enable(this);
    }
}
