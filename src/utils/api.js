// ═══════════════════════════════════════════
// API Base URL Helper
// Capacitor 앱에서는 절대 URL 사용
// ═══════════════════════════════════════════

function isCapacitor() {
  // Capacitor 네이티브 환경 감지 (가장 정확한 방법)
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function getApiBase() {
  if (isCapacitor()) {
    return 'https://pillstack.kr';
  }
  // 웹: dev(localhost:5173) or prod(pillstack.kr) — 상대 URL 사용
  return '';
}

export const API_BASE = getApiBase();

export function apiUrl(path) {
  const url = `${API_BASE}${path}`;
  // 디버그 로그 (프로덕션에서 제거 가능)
  if (isCapacitor()) {
    console.log('[API]', url);
  }
  return url;
}
