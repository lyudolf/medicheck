// ═══════════════════════════════════════════
// FCM Push Notification Service
// ═══════════════════════════════════════════

let pushModule = null;

/**
 * FCM 푸시 알림 초기화 (Capacitor 네이티브 환경에서만 동작)
 */
export async function initPushNotifications() {
  try {
    pushModule = await import('@capacitor/push-notifications');
    const { PushNotifications } = pushModule;

    // 권한 요청
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[FCM] 알림 권한 거부됨');
      return;
    }

    // FCM 토큰 등록
    await PushNotifications.register();

    // 토큰 수신 리스너
    PushNotifications.addListener('registration', (token) => {
      console.log('[FCM] 토큰:', token.value);
      // 서버에 토큰 저장 (Supabase)
      saveFCMToken(token.value);
    });

    // 토큰 등록 실패
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[FCM] 등록 실패:', err);
    });

    // 앱이 열려있을 때 알림 수신
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[FCM] 알림 수신:', notification);
      // 인앱 토스트로 표시
      if (window.app?.showToast) {
        window.app.showToast(`💊 ${notification.title || notification.body}`, 'info');
      }
    });

    // 알림 탭 → 앱 열기
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[FCM] 알림 탭:', action);
      // 홈으로 이동
      if (window.app?.navigate) {
        window.app.navigate('home');
      }
    });

    console.log('[FCM] 초기화 완료');
  } catch (e) {
    console.warn('[FCM] 초기화 건너뜀 (웹 환경):', e.message);
  }
}

/**
 * FCM 토큰을 Supabase에 저장
 */
async function saveFCMToken(token) {
  try {
    const user = window.app?.getState()?.user;
    if (!user) return;

    // localStorage에 캐시 (중복 저장 방지)
    const cachedToken = localStorage.getItem('pillstack_fcm_token');
    if (cachedToken === token) return;

    const { getSession } = await import('../lib/supabase.js');
    const session = await getSession();
    if (!session?.access_token) return;

    // Vercel API로 토큰 저장
    await fetch('/api/fcm/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token, platform: 'android' }),
    });

    localStorage.setItem('pillstack_fcm_token', token);
    console.log('[FCM] 토큰 저장 완료');
  } catch (e) {
    console.warn('[FCM] 토큰 저장 실패:', e.message);
  }
}
