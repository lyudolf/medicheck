package kr.pillstack;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Edge-to-Edge 활성화 (Android 15+ / SDK 35+ 필수)
        EdgeToEdge.enable(this);

        super.onCreate(savedInstanceState);

        // 시스템 글꼴 크기 설정 무시 — UI 레이아웃 깨짐 방지
        WebView webView = getBridge().getWebView();
        webView.getSettings().setTextZoom(100);
    }
}
