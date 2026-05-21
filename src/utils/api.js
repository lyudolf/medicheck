// ═══════════════════════════════════════════
// API Base URL Helper
// Capacitor 앱에서는 절대 URL 사용
// ═══════════════════════════════════════════

function getApiBase() {
  // Capacitor 앱: capacitor://localhost 또는 https://localhost
  // 웹: https://pillstack.kr 또는 localhost:5173 (dev)
  const proto = window.location.protocol;
  const host = window.location.hostname;
  
  if (proto === 'capacitor:' || (host === 'localhost' && !window.location.port)) {
    return 'https://pillstack.kr';
  }
  return '';
}

export const API_BASE = getApiBase();

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
