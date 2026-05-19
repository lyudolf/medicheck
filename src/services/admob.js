// ═══════════════════════════════════════════
// AdMob Service - 광고 수익화
// ═══════════════════════════════════════════

let admobModule = null;
let isAdMobReady = false;
let rewardedLoaded = false;

// AdMob 테스트 광고 ID (배포 시 실제 ID로 교체)
const AD_IDS = {
  rewarded: 'ca-app-pub-3509783767575021/3892209787',
  interstitial: 'ca-app-pub-3940256099942544/1033173712', // 미사용 (추후 필요 시)
};

// 하루 무료 분석 횟수
const FREE_DAILY_LIMIT = 3;

/**
 * AdMob 초기화 (Capacitor 네이티브 환경에서만 동작)
 */
export async function initAdMob() {
  try {
    admobModule = await import('@capacitor-community/admob');
    const { AdMob } = admobModule;

    await AdMob.initialize({
      requestTrackingAuthorization: false,
    });

    isAdMobReady = true;
    console.log('[AdMob] 초기화 완료');

    // 리워드 광고 미리 로드
    await prepareRewardedAd();
  } catch (e) {
    // 웹 환경이거나 플러그인 미설치 시 무시
    console.warn('[AdMob] 초기화 건너뜀 (웹 환경):', e.message);
    isAdMobReady = false;
  }
}

/**
 * 리워드 광고 미리 로드
 */
async function prepareRewardedAd() {
  if (!isAdMobReady || !admobModule) return;
  try {
    const { AdMob } = admobModule;
    await AdMob.prepareRewardedAd({ adId: AD_IDS.rewarded });
    rewardedLoaded = true;
    console.log('[AdMob] 리워드 광고 로드됨');
  } catch (e) {
    console.warn('[AdMob] 리워드 로드 실패:', e.message);
    rewardedLoaded = false;
  }
}

/**
 * 리워드 광고 표시 → 보상 지급
 * @returns {Promise<boolean>} 리워드 획득 여부
 */
export async function showRewardedAd() {
  if (!isAdMobReady || !admobModule) {
    console.warn('[AdMob] 광고 사용 불가 — 무료 분석 제공');
    return true; // 웹 환경에서는 광고 없이 허용
  }

  if (!rewardedLoaded) {
    await prepareRewardedAd();
    if (!rewardedLoaded) return false;
  }

  try {
    const { AdMob } = admobModule;

    return new Promise((resolve) => {
      // 리워드 수신 리스너
      const rewardListener = AdMob.addListener('onRewardedAdReward', () => {
        resolve(true);
      });

      // 광고 닫힘 리스너 (리워드 없이 닫은 경우)
      const dismissListener = AdMob.addListener('onRewardedAdDismissed', () => {
        rewardListener.remove();
        dismissListener.remove();
        rewardedLoaded = false;
        prepareRewardedAd(); // 다음 광고 미리 로드
        resolve(false);
      });

      AdMob.showRewarded();
    });
  } catch (e) {
    console.error('[AdMob] 리워드 광고 표시 실패:', e);
    rewardedLoaded = false;
    return false;
  }
}

/**
 * 오늘 분석 횟수 확인
 */
export function getTodayAnalysisCount() {
  const today = new Date().toISOString().split('T')[0];
  const data = JSON.parse(localStorage.getItem('pillstack_analysis_usage') || '{}');
  if (data.date !== today) return 0;
  return data.count || 0;
}

/**
 * 분석 횟수 증가
 */
export function incrementAnalysisCount() {
  const today = new Date().toISOString().split('T')[0];
  const data = JSON.parse(localStorage.getItem('pillstack_analysis_usage') || '{}');
  if (data.date !== today) {
    localStorage.setItem('pillstack_analysis_usage', JSON.stringify({ date: today, count: 1 }));
  } else {
    data.count = (data.count || 0) + 1;
    localStorage.setItem('pillstack_analysis_usage', JSON.stringify(data));
  }
}

/**
 * 분석 가능 여부 확인
 * @returns {{ allowed: boolean, remaining: number, needAd: boolean }}
 */
export function checkAnalysisQuota() {
  const count = getTodayAnalysisCount();
  if (count < FREE_DAILY_LIMIT) {
    return { allowed: true, remaining: FREE_DAILY_LIMIT - count, needAd: false };
  }
  return { allowed: false, remaining: 0, needAd: true };
}

export { FREE_DAILY_LIMIT, isAdMobReady };
