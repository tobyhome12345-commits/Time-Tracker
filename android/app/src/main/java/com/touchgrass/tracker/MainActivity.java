package com.touchgrass.tracker;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Draw behind the status + navigation bars on every Android version; the web app pads itself
        // using the safe-area insets Capacitor's SystemBars injects.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
