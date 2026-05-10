package app.notai.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Notai Android entry point. Translates ACTION_SEND share intents
 * into a deep link the web layer can read via
 * Capacitor's App.getLaunchUrl() / appUrlOpen listener.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();
        if (!Intent.ACTION_SEND.equals(action) || type == null) return;
        if (!type.startsWith("text/")) return;
        String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (shared == null || shared.isEmpty()) return;
        Uri target = Uri.parse(
                "https://notai.app/app/quick-capture?shared=" + Uri.encode(shared));
        intent.setData(target);
    }
}
