// ═══════════════════════════════════════════
// Firebase Analytics Service
// 핵심 사용자 행동 추적
// ═══════════════════════════════════════════

let analyticsModule = null;
let isReady = false;

/**
 * Firebase Analytics 초기화
 */
export async function initAnalytics() {
  try {
    analyticsModule = await import('@capacitor-firebase/analytics');
    isReady = true;
    console.log('[Analytics] 초기화 완료');
    
    // 앱 시작 이벤트
    logEvent('app_open');
  } catch (e) {
    console.warn('[Analytics] 초기화 건너뜀 (웹 환경):', e.message);
  }
}

/**
 * 커스텀 이벤트 로깅
 * @param {string} name - 이벤트명
 * @param {Object} params - 추가 파라미터
 */
export async function logEvent(name, params = {}) {
  if (!isReady || !analyticsModule) return;
  try {
    await analyticsModule.FirebaseAnalytics.logEvent({ name, params });
  } catch (e) {
    // 무시 — 분석 실패가 앱 기능에 영향 주면 안됨
  }
}

/**
 * 화면 조회 추적
 * @param {string} screenName - 화면명
 */
export async function logScreenView(screenName) {
  if (!isReady || !analyticsModule) return;
  try {
    await analyticsModule.FirebaseAnalytics.setCurrentScreen({ screenName });
  } catch (e) {}
}

/**
 * 사용자 속성 설정
 * @param {string} key
 * @param {string} value
 */
export async function setUserProperty(key, value) {
  if (!isReady || !analyticsModule) return;
  try {
    await analyticsModule.FirebaseAnalytics.setUserProperty({ key, value });
  } catch (e) {}
}

/**
 * 사용자 ID 설정 (로그인 시)
 */
export async function setUserId(userId) {
  if (!isReady || !analyticsModule) return;
  try {
    await analyticsModule.FirebaseAnalytics.setUserId({ userId });
  } catch (e) {}
}
