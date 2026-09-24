package com.ihype.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /*
     * PASSKEYS IN THE WEBVIEW (2026-09-24, DESIGN_SYNC row 513).
     *
     * An android.webkit.WebView answers navigator.credentials with nothing
     * unless the app opts in, and neither this activity nor Capacitor did, so
     * "Sign in with passkey" and passkey sign-up were offered in the Android
     * app and could only fail. WEB_AUTHENTICATION_SUPPORT_FOR_APP hands the
     * ceremony to Credential Manager as this app; the other half is the
     * `delegate_permission/common.get_login_creds` relation that
     * /.well-known/assetlinks.json now grants the app for ihype.org. The
     * third half is the server: in this mode clientDataJSON carries
     * `android:apk-key-hash:<base64url cert digest>`, not https://ihype.org,
     * so src/lib/passkey.ts accepts one such origin per certificate in
     * ANDROID_CERT_SHA256_FINGERPRINTS. Without it the device accepts the
     * passkey and the server refuses it. Ship the server before this binary.
     *
     * Feature-checked: on a WebView too old to support it this is a no-op and
     * the magic-link path is the way in, exactly as before. Still to be proved
     * on a handset — the build cannot drive a ceremony.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView != null && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                webView.getSettings(),
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
            );
        }
    }
}
