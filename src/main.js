// ═══════════════════════════════════════════
// MediCheck - Main Application Controller
// ═══════════════════════════════════════════


import { renderHome, renderHomeFAB } from './components/home.js';
import { renderSearch, handleSearch, filterCategory, clearSearch, getSupplementById, initSearch } from './components/search.js';
import { renderCamera, initCamera, capturePhoto, handleImageUpload, retakePhoto, startOCR, destroyCamera } from './components/camera.js';
import { renderAnalysis } from './components/analysis.js';
import { renderSettings } from './components/settings.js';
import { renderSchedule, saveTimingResult, loadTimingResult } from './components/schedule.js';
import { renderCalendar, setCalendarMonth, handleDayClick } from './components/calendar.js';
import { showProductDetail, closeProductDetail, getCurrentProduct } from './components/detail.js';
import { showDisclaimerModal, agreeDisclaimer } from './components/disclaimer.js';
import { renderLogin } from './components/login.js';
import { renderNotifications } from './components/notifications.js';
import { analyzeInteractions, getTimingRecommendation } from './engine/analyzer.js';
import { publicDataAPI } from './api/publicData.js';
import { saveReminderTime, initServiceWorker, requestNotificationPermission, syncRemindersToSW, saveScheduleForSW, loadReminders } from './services/reminder.js';
import { signInWithGoogle, signInWithKakao, signOut, getSession, onAuthStateChange } from './lib/supabase.js';
import { fetchSupplements, insertSupplement, deleteSupplement, fetchAnalysis, upsertAnalysis, deleteAnalysis } from './services/db.js';
import { initAdMob, showRewardedAd, checkAnalysisQuota, incrementAnalysisCount, FREE_DAILY_LIMIT } from './services/admob.js';
import { initPushNotifications } from './services/fcm.js';
import { initLocalNotifications, scheduleReminders } from './services/localNotification.js';
import { markAsRead, markAllAsRead, clearAll, getUnreadCount } from './services/notificationStore.js';
import { apiUrl } from './utils/api.js';
import { initAnalytics, logEvent, logScreenView, setUserId } from './services/analytics.js';

// ─── State Management ───
const STORAGE_KEY = 'medicheck_supplements';

export const state = {
  currentPage: 'home',
  supplements: [],
  analysisResult: null,
  timingResult: null,
  apiConnected: false,
  user: null,
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state.supplements = JSON.parse(saved);
    const savedTiming = loadTimingResult();
    if (savedTiming) state.timingResult = savedTiming;
    const savedAnalysis = localStorage.getItem('pillstack_analysis_result');
    if (savedAnalysis) state.analysisResult = JSON.parse(savedAnalysis);
  } catch (e) {
    console.warn('로컈 데이터 로드 실패:', e);
  }
}

// 로그인 유저 Supabase 데이터 복원
async function loadUserData(userId) {
  try {
    const [supplements, analysis] = await Promise.all([
      fetchSupplements(userId),
      fetchAnalysis(userId),
    ]);
    if (supplements.length > 0) {
      state.supplements = supplements;
      saveState(); // localStorage 동기화
    }
    if (analysis) {
      state.analysisResult = analysis.result_data;
      state.timingResult = analysis.timing_data;
      if (analysis.result_data) localStorage.setItem('pillstack_analysis_result', JSON.stringify(analysis.result_data));
      if (analysis.timing_data) saveTimingResult(analysis.timing_data);
    }
    render();
  } catch (e) {
    console.warn('Supabase 데이터 로드 실패 (localhost fallback):', e);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.supplements));
}

// ─── Navigation ───
function navigate(page) {
  destroyCamera();
  state.currentPage = page;
  render();

  if (page === 'camera') {
    setTimeout(() => initCamera(), 300);
  }
  if (page === 'search') {
    setTimeout(() => initSearch(), 100);
  }
}

// ─── Supplement Management ───
export function addSupplement(supplement) {
  if (state.supplements.find((s) => s.id === supplement.id)) {
    showToast('이미 추가된 영양제입니다.', 'info');
    return;
  }
  // 잔여량 추적 기본값 주입
  const enriched = {
    ...supplement,
    totalPills: supplement.totalPills || 60,
    dosagePerTake: supplement.dosagePerTake || 1,
    remainingPills: supplement.remainingPills ?? supplement.totalPills ?? 60,
  };
  state.supplements.push(enriched);
  saveState();
  state.analysisResult = null;
  state.timingResult = null;
  localStorage.removeItem('pillstack_analysis_result');
  localStorage.removeItem('medicheck_timing_result');
  localStorage.removeItem('medicheck_schedule');
  // Supabase 동기화 (로그인 시)
  if (state.user) {
    insertSupplement(state.user.id, enriched).catch(e => console.warn('Supabase insert 실패:', e));
    deleteAnalysis(state.user.id).catch(() => {});
  }
  // Analytics: 영양제 등록
  logEvent('supplement_added', { name: supplement.name, total_count: state.supplements.length });
  showToast(`✅ ${supplement.name} 추가됨!`, 'success');
}

export function removeSupplement(id) {
  const idx = state.supplements.findIndex((s) => s.id === id);
  if (idx !== -1) {
    const name = state.supplements[idx].name;
    state.supplements.splice(idx, 1);
    saveState();
    state.analysisResult = null;
    state.timingResult = null;
    localStorage.removeItem('pillstack_analysis_result');
    localStorage.removeItem('medicheck_timing_result');
    localStorage.removeItem('medicheck_schedule');
    // Supabase 동기화 (로그인 시)
    if (state.user) {
      deleteSupplement(state.user.id, id).catch(e => console.warn('Supabase delete 실패:', e));
      deleteAnalysis(state.user.id).catch(() => {});
    }
    // Analytics: 영양제 삭제
    logEvent('supplement_removed', { name, remaining_count: state.supplements.length });
    showToast(`🗑️ ${name} 삭제됨`, 'info');
    render();
  }
}

// ─── Native Local Notification Helper ───
async function _scheduleNativeReminders(timingResult) {
  if (!timingResult?.schedule) return;
  const times = loadReminders();
  const slotMap = { '아침': 'morning', '저녁': 'evening', '취침 전': 'bedtime' };

  const schedule = timingResult.schedule.map(s => {
    const slot = slotMap[s.label] || 'morning';
    return {
      slot,
      time: times[slot],
      supplements: s.supplements.map(sup => ({ name: sup.name })),
    };
  }).filter(s => s.supplements.length > 0);

  scheduleReminders(schedule).catch(console.warn);
}

// ─── Analysis ───
async function startAnalysis() {
  if (state.supplements.length < 2) {
    showToast('영양제를 2개 이상 등록해주세요.', 'error');
    return;
  }

  // 광고 게이트: 하루 무료 횟수 초과 시 리워드 광고 시청
  const quota = checkAnalysisQuota();
  if (quota.needAd) {
    showToast('📺 추가 분석을 위해 광고를 시청해주세요.', 'info');
    const rewarded = await showRewardedAd();
    if (!rewarded) {
      showToast('광고 시청이 완료되지 않았습니다.', 'error');
      return;
    }
  }

  showLoading(true);
  // Analytics: 분석 시작
  logEvent('analysis_started', { supplement_count: state.supplements.length });

  try {
    state.analysisResult = await analyzeInteractions(state.supplements);
    state.timingResult = getTimingRecommendation(state.supplements);
    // localStorage 저장
    localStorage.setItem('pillstack_analysis_result', JSON.stringify(state.analysisResult));
    saveTimingResult(state.timingResult);
    saveScheduleForSW(state.timingResult);
    // 네이티브 로컬 알림 등록
    _scheduleNativeReminders(state.timingResult);
    // Supabase 저장 (로그인 시)
    if (state.user) {
      upsertAnalysis(state.user.id, state.analysisResult, state.timingResult)
        .catch(e => console.warn('Supabase analysis upsert 실패:', e));
    }
    incrementAnalysisCount();
    // Analytics: 분석 완료
    logEvent('analysis_completed', { score: state.analysisResult.score, conflict_count: state.analysisResult.conflictCount });
    state.currentPage = 'analysis';
    render();
  } catch (err) {
    console.error('분석 오류:', err);
    showToast('분석 중 오류가 발생했습니다.', 'error');
  } finally {
    showLoading(false);
  }
}

// ─── Search Actions ───
function addFromSearch(id) {
  const supplement = getSupplementById(id);
  if (supplement) {
    addSupplement(supplement);
    // Refresh search results to show checkmark
    const input = document.getElementById('search-input');
    if (input) handleSearch(input.value);
  }
}

// ─── Detail View ───
function showDetail(id) {
  const product = getSupplementById(id);
  if (product) showProductDetail(product);
}

function closeDetail() {
  closeProductDetail();
}

function addFromDetail() {
  const product = getCurrentProduct();
  if (product) {
    addSupplement(product);
    closeProductDetail();
  }
}

// ─── API Status ───
async function refreshApiStatus() {
  showToast('🔄 API 연결 확인 중...', 'info');
  const connected = await publicDataAPI.checkHealth();
  state.apiConnected = connected;
  showToast(connected ? '✅ 공공데이터 API 연결됨!' : '💾 로컬 DB 모드 사용 중', connected ? 'success' : 'info');
  render();
}

function clearAllData() {
  if (confirm('모든 데이터를 삭제하시겠습니까?')) {
    state.supplements = [];
    state.analysisResult = null;
    state.timingResult = null;
    localStorage.removeItem(STORAGE_KEY);
    showToast('🗑️ 모든 데이터가 초기화되었습니다.', 'info');
    navigate('home');
  }
}

async function toggleSetting(key, value) {
  localStorage.setItem(key, value);

  // 알림 토글 ON 시 권한 요청 + SW 동기화
  if (key === 'medicheck_noti' && value) {
    const permission = await requestNotificationPermission();
    if (permission === 'denied') {
      localStorage.setItem(key, false);
      showToast('⚠️ 알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.', 'error');
      render();
      return;
    }
    if (permission === 'granted') {
      syncRemindersToSW();
      showToast('🔔 복용 알림이 활성화되었습니다!', 'success');
    }
  } else if (key === 'medicheck_noti' && !value) {
    syncRemindersToSW();
    showToast('🔕 복용 알림이 비활성화되었습니다.', 'info');
  } else {
    showToast('✅ 설정이 저장되었습니다.', 'success');
  }
}

function exportData() {
  const data = {
    supplements: state.supplements,
    exportDate: new Date().toISOString(),
    version: '1.0.0',
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medicheck_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 데이터를 내보냈습니다.', 'success');
}

function setReminderTime(slot, time) {
  saveReminderTime(slot, time);
  const labels = { morning: '아침', evening: '저녁', bedtime: '취침 전' };
  showToast(`⏰ ${labels[slot] || slot} 복용 시간: ${time}`, 'success');
  // 네이티브 알림 재등록
  if (state.timingResult) {
    _scheduleNativeReminders(state.timingResult);
  }
}

// ─── Custom Time Picker Modal (iOS Wheel Style) ───
let _tpSlot = null;
let _tpHour = 8;
let _tpMin = 0;

function openTimePicker(slot, currentTime) {
  _tpSlot = slot;
  const parts = (currentTime || '08:00').split(':');
  _tpHour = parseInt(parts[0]) || 8;
  _tpMin = parseInt(parts[1]) || 0;
  _renderTimePickerModal();
  requestAnimationFrame(() => {
    const overlay = document.getElementById('time-picker-overlay');
    if (overlay) overlay.classList.add('active');
    // Scroll to initial values
    _tpScrollTo('tp-hour-wheel', _tpHour, 24);
    _tpScrollTo('tp-min-wheel', _tpMin / 5, 12);
  });
}

function closeTimePicker() {
  const overlay = document.getElementById('time-picker-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

function _tpScrollTo(id, index, total) {
  const el = document.getElementById(id);
  if (!el) return;
  const itemH = 44;
  el.scrollTop = index * itemH;
}

function _tpHandleScroll(type) {
  const id = type === 'hour' ? 'tp-hour-wheel' : 'tp-min-wheel';
  const el = document.getElementById(id);
  if (!el) return;
  const itemH = 44;
  const idx = Math.round(el.scrollTop / itemH);
  if (type === 'hour') {
    _tpHour = ((idx % 24) + 24) % 24;
  } else {
    _tpMin = (((idx % 12) + 12) % 12) * 5;
  }
}

function tpConfirm() {
  // Read final scroll positions
  _tpHandleScroll('hour');
  _tpHandleScroll('min');
  const time = `${String(_tpHour).padStart(2, '0')}:${String(_tpMin).padStart(2, '0')}`;
  setReminderTime(_tpSlot, time);
  closeTimePicker();
  render();
}

function _renderTimePickerModal() {
  const existing = document.getElementById('time-picker-overlay');
  if (existing) existing.remove();

  const labels = { morning: '🌅 아침', evening: '🌙 저녁', bedtime: '😴 취침 전' };
  const label = labels[_tpSlot] || _tpSlot;

  // Generate hour items (0-23)
  const hours = Array.from({ length: 24 }, (_, i) =>
    `<div class="tp-wheel-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`
  ).join('');

  // Generate minute items (0-55, step 5)
  const mins = Array.from({ length: 12 }, (_, i) =>
    `<div class="tp-wheel-item" data-val="${i * 5}">${String(i * 5).padStart(2, '0')}</div>`
  ).join('');

  const html = `
    <div class="time-picker-overlay" id="time-picker-overlay" onclick="if(event.target===this) window.app.closeTimePicker()">
      <div class="time-picker-modal">
        <div class="tp-handle"></div>
        <div class="time-picker-modal-header">
          <div class="time-picker-modal-title">${label} 복용 시간</div>
          <button class="time-picker-modal-close" onclick="window.app.closeTimePicker()">✕</button>
        </div>
        <div class="tp-wheel-container">
          <div class="tp-wheel-highlight"></div>
          <div class="tp-wheel-col">
            <div class="tp-wheel-label">시간</div>
            <div class="tp-wheel-scroll" id="tp-hour-wheel">
              <div class="tp-wheel-pad"></div>
              ${hours}
              <div class="tp-wheel-pad"></div>
            </div>
          </div>
          <div class="tp-wheel-colon">:</div>
          <div class="tp-wheel-col">
            <div class="tp-wheel-label">분</div>
            <div class="tp-wheel-scroll" id="tp-min-wheel">
              <div class="tp-wheel-pad"></div>
              ${mins}
              <div class="tp-wheel-pad"></div>
            </div>
          </div>
        </div>
        <button class="time-picker-confirm" onclick="window.app.tpConfirm()">확인</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  // Add scroll snap behavior after render
  const hWheel = document.getElementById('tp-hour-wheel');
  const mWheel = document.getElementById('tp-min-wheel');
  if (hWheel) {
    hWheel.addEventListener('scrollend', () => _tpHandleScroll('hour'));
    hWheel.addEventListener('touchend', () => setTimeout(() => _tpHandleScroll('hour'), 150));
  }
  if (mWheel) {
    mWheel.addEventListener('scrollend', () => _tpHandleScroll('min'));
    mWheel.addEventListener('touchend', () => setTimeout(() => _tpHandleScroll('min'), 150));
  }
}

function toggleDoseCheck(slot) {
  const today = new Date().toISOString().slice(0, 10);
  const key = 'medicheck_checked_' + today;
  let checked = [];
  try {
    const saved = localStorage.getItem(key);
    if (saved) checked = JSON.parse(saved);
  } catch (e) { /* ignore */ }

  const idx = checked.indexOf(slot);
  if (idx === -1) {
    checked.push(slot);
    // 잔여량 차감
    const supp = state.supplements.find(s => (s.id || s.name) === slot);
    if (supp && typeof supp.remainingPills === 'number') {
      supp.remainingPills = Math.max(0, supp.remainingPills - (supp.dosagePerTake || 1));
      saveState();
    }
    showToast('✅ 복용 완료!', 'success');
  } else {
    checked.splice(idx, 1);
    // 잔여량 복원
    const supp = state.supplements.find(s => (s.id || s.name) === slot);
    if (supp && typeof supp.remainingPills === 'number') {
      supp.remainingPills = Math.min(supp.totalPills || 60, supp.remainingPills + (supp.dosagePerTake || 1));
      saveState();
    }
    showToast('↩️ 복용 체크 해제', 'info');
  }
  localStorage.setItem(key, JSON.stringify(checked));
  render();
}

// ─── Inventory Management ───
function updateSupplementInventory(id, totalPills, dosagePerTake) {
  const supp = state.supplements.find(s => s.id === id);
  if (!supp) return;
  const oldTotal = supp.totalPills || 60;
  supp.totalPills = totalPills;
  supp.dosagePerTake = dosagePerTake;
  // 총 수량이 변경되면 잔여량도 비례 조정
  if (totalPills !== oldTotal) {
    supp.remainingPills = Math.min(totalPills, supp.remainingPills ?? totalPills);
  }
  saveState();
  render();
  showToast('✅ 수량 정보가 업데이트되었습니다.', 'success');
}

function refillSupplement(id) {
  const supp = state.supplements.find(s => s.id === id);
  if (!supp) return;
  supp.remainingPills = supp.totalPills || 60;
  saveState();
  render();
  showToast('🔄 리필 완료! 잔여량이 초기화되었습니다.', 'success');
}

function getCoupangSearchUrl(productName) {
  const keyword = encodeURIComponent(productName);
  // 쿠팡 파트너스 ID는 추후 .env에서 설정
  // TODO: 파트너스 승인 후 Deeplink API 연동 예정 (AF7110745)
  return `https://www.coupang.com/np/search?component=&q=${keyword}`;
}

// ─── UI Helpers ───
function showToast(message, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.className = `toast ${type}`;
  toast.innerHTML = message;

  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  });
}

function showLoading(show) {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay && show) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-icon">💊</div>
      <div class="loading-text">성분 분석 중...</div>
      <div class="loading-sub">상호작용을 확인하고 있어요</div>
      <div style="margin-top:16px;"><div class="spinner"></div></div>
    `;
    document.body.appendChild(overlay);
  }

  if (overlay) {
    requestAnimationFrame(() => overlay.classList.toggle('active', show));
    if (!show) {
      setTimeout(() => overlay?.remove(), 300);
    }
  }
}

// ─── Render ───
function render() {
  const app = document.getElementById('app');

  // 로그인 안 됐으면 로그인 페이지
  if (!state.user) {
    app.innerHTML = renderLogin();
    return;
  }

  let pageHTML = '';

  switch (state.currentPage) {
    case 'home':
      pageHTML = renderHome();
      break;
    case 'search':
      pageHTML = renderSearch();
      break;
    case 'schedule':
      pageHTML = renderSchedule();
      break;
    case 'calendar':
      pageHTML = renderCalendar();
      break;
    case 'camera':
      pageHTML = renderCamera();
      break;
    case 'analysis':
      pageHTML = renderAnalysis(state.analysisResult, state.timingResult);
      break;
    case 'settings':
      pageHTML = renderSettings();
      break;
    case 'notifications':
      pageHTML = renderNotifications();
      break;
    default:
      pageHTML = renderHome();
  }

  const fabHTML = state.currentPage === 'home' ? renderHomeFAB() : '';
  app.innerHTML = _renderGlobalHeader() + `<main class="app-content">${pageHTML}</main>` + fabHTML + _renderBottomNav();
}

function _renderGlobalHeader() {
  const unread = getUnreadCount();
  const badgeHTML = unread > 0
    ? `<span class="notif-badge">${unread > 99 ? '99+' : unread}</span>`
    : '';

  return `
    <header class="global-header">
      <div class="home-logo" onclick="window.app.navigate('home')" style="cursor:pointer;">
        <img src="/icons/icon.png" alt="PillStack" class="home-logo-icon" style="width:36px;height:36px;border-radius:8px;" />
        <span class="home-logo-text">PillStack</span>
      </div>
      <div class="home-header-actions">
        <button class="home-noti-btn notif-bell-btn" onclick="window.app.navigate('notifications')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          ${badgeHTML}
        </button>
        <button class="home-noti-btn" onclick="window.app.navigate('settings')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </header>
  `;
}

function _renderBottomNav() {
  const p = state.currentPage;
  const icons = {
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    analysis: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    settings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };
  return `
    <nav class="bottom-nav">
      <button class="nav-item ${p === 'home' ? 'active' : ''}"
              onclick="window.app.navigate('home')">
        <span class="nav-icon">${icons.home}</span>
        <span>홈</span>
      </button>
      <button class="nav-item ${p === 'search' ? 'active' : ''}"
              onclick="window.app.navigate('search')">
        <span class="nav-icon">${icons.search}</span>
        <span>검색</span>
      </button>
      <button class="nav-item nav-center-fab ${p === 'camera' ? 'active' : ''}"
              onclick="window.app.navigate('camera')">
        <span class="nav-fab-circle">${icons.camera}</span>
        <span>AI 인식</span>
      </button>
      <button class="nav-item ${p === 'analysis' || p === 'schedule' ? 'active' : ''}"
              onclick="window.app.navigate('analysis')">
        <span class="nav-icon">${icons.analysis}</span>
        <span>분석</span>
      </button>
      <button class="nav-item ${p === 'calendar' ? 'active' : ''}"
              onclick="window.app.navigate('calendar')">
        <span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
        <span>캘린더</span>
      </button>
    </nav>
  `;
}

window.app = {
  navigate,
  addSupplement,
  removeSupplement,
  addFromSearch,
  showDetail,
  closeDetail,
  addFromDetail,
  startAnalysis,
  handleSearch,
  filterCategory,
  clearSearch,
  capturePhoto,
  handleImageUpload,
  retakePhoto,
  startOCR,
  refreshApiStatus,
  setReminderTime,
  openTimePicker,
  closeTimePicker,
  tpConfirm,
  toggleDoseCheck,
  updateSupplementInventory,
  refillSupplement,
  getCoupangSearchUrl,
  showToast,
  showShelfDetail: (id) => {
    const supp = state.supplements.find(s => s.id === id);
    if (supp) showProductDetail(supp, true);
  },
  switchAnalysisTab: (tabId) => {
    document.querySelectorAll('.analysis-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.analysis-tab').forEach(el => el.classList.remove('active'));
    const tab = document.getElementById('tab-' + tabId);
    if (tab) tab.style.display = 'block';
    const btn = document.querySelector(`.analysis-tab[data-tab="${tabId}"]`);
    if (btn) btn.classList.add('active');
  },
  agreeDisclaimer,
  // Calendar
  calPrev: () => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth());
    // Get current view from calendar state
    let m = parseInt(localStorage.getItem('_cal_m') ?? new Date().getMonth());
    let y = parseInt(localStorage.getItem('_cal_y') ?? new Date().getFullYear());
    m--;
    if (m < 0) { m = 11; y--; }
    localStorage.setItem('_cal_m', m);
    localStorage.setItem('_cal_y', y);
    setCalendarMonth(y, m);
    render();
  },
  calNext: () => {
    let m = parseInt(localStorage.getItem('_cal_m') ?? new Date().getMonth());
    let y = parseInt(localStorage.getItem('_cal_y') ?? new Date().getFullYear());
    m++;
    if (m > 11) { m = 0; y++; }
    localStorage.setItem('_cal_m', m);
    localStorage.setItem('_cal_y', y);
    setCalendarMonth(y, m);
    render();
  },
  calDayClick: (dateStr) => {
    const msg = handleDayClick(dateStr);
    showToast(msg, 'info');
  },
  loginWithGoogle: async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      showToast('Google 로그인 실패: ' + e.message, 'error');
    }
  },
  loginWithKakao: async () => {
    try {
      await signInWithKakao();
    } catch (e) {
      showToast('Kakao 로그인 실패: ' + e.message, 'error');
    }
  },
  logout: async () => {
    try {
      await signOut();
      state.user = null;
      render();
      showToast('로그아웃 되었습니다.', 'info');
    } catch (e) {
      showToast('로그아웃 실패', 'error');
    }
  },
  requestDeleteAccount: async () => {
    if (!state.user) {
      showToast('로그인이 필요합니다.', 'error');
      return;
    }
    const confirmed = confirm(
      '⚠️ 정말 계정을 삭제하시겠습니까?\n\n' +
      '• 요청 후 7일 뒤 모든 데이터가 영구 삭제됩니다.\n' +
      '• 7일 내 재로그인하면 취소됩니다.\n' +
      '• 삭제된 데이터는 복구할 수 없습니다.'
    );
    if (!confirmed) return;

    try {
      const session = await getSession();
      const res = await fetch(apiUrl('/api/account/delete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason: '사용자 직접 요청' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await signOut();
      state.user = null;
      state.supplements = [];
      state.analysisResult = null;
      localStorage.clear();
      render();
      showToast('탈퇴 요청이 접수되었습니다. 7일 후 모든 데이터가 삭제됩니다.', 'info');
    } catch (e) {
      showToast('탈퇴 요청 실패: ' + e.message, 'error');
    }
  },
  getState: () => state,
  toggleSetting: (key, value) => {
    localStorage.setItem(key, value);
    render();
  },
  clearAllData: () => {
    if (!confirm('등록된 영양제 목록을 모두 삭제하시겠습니까?')) return;
    state.supplements = [];
    state.analysisResult = null;
    localStorage.removeItem('medicheck_supplements');
    localStorage.removeItem('pillstack_analysis_result');
    render();
    showToast('데이터가 초기화되었습니다.', 'info');
  },
  exportData: () => {
    const data = JSON.stringify(state.supplements, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pillstack-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('데이터를 내보냈습니다.', 'success');
  },
  toggleNotification: async (enabled) => {
    const { setNotificationEnabled } = await import('./services/localNotification.js');
    setNotificationEnabled(enabled);
    if (enabled && state.timingResult) {
      _scheduleNativeReminders(state.timingResult);
    }
    showToast(enabled ? '🔔 복용 알림이 켜졌습니다.' : '🔕 복용 알림이 꺼졌습니다.', 'info');
  },
  // ─── Notification Center ───
  markNotificationRead: (id) => {
    markAsRead(id);
    render();
  },
  markAllNotificationsRead: () => {
    markAllAsRead();
    render();
    showToast('✅ 모든 알림을 읽음 처리했습니다.', 'success');
  },
  clearAllNotifications: () => {
    if (confirm('모든 알림을 삭제하시겠습니까?')) {
      clearAll();
      render();
      showToast('🗑️ 모든 알림이 삭제되었습니다.', 'info');
    }
  },
};

// ─── Init ───
async function init() {
  loadState();

  // 스플래시 제거 + 렌더는 어떤 에러가 나도 반드시 실행
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 600);
    }
    render();
    if (state.user) showDisclaimerModal();
  }, 1200);

  // Supabase 세션 확인 (실패해도 앱 진행)
  try {
    const session = await getSession();
    state.user = session?.user || null;
  } catch {
    state.user = null;
  }

  // 인증 상태 변화 감지
  try {
    onAuthStateChange(async (event, session) => {
      state.user = session?.user || null;
      if (event === 'SIGNED_IN' && state.user) {
        showToast(`👋 ${state.user?.user_metadata?.full_name || '사용자'}님 환영합니다!`, 'success');
        showDisclaimerModal();
        // Analytics: 로그인
        setUserId(state.user.id);
        logEvent('login', { method: state.user.app_metadata?.provider || 'unknown' });
        await loadUserData(state.user.id);
      } else if (event === 'SIGNED_OUT') {
        state.supplements = [];
        state.analysisResult = null;
        state.timingResult = null;
        localStorage.removeItem('medicheck_supplements');
        localStorage.removeItem('pillstack_analysis_result');
        render();
      } else {
        render();
      }
    });
  } catch (e) {
    console.warn('Auth listener 등록 실패:', e);
  }

  // Service Worker 등록 (백그라운드)
  initServiceWorker().catch(console.warn);

  // AdMob 초기화 (백그라운드, 네이티브 앱에서만 동작)
  initAdMob().catch(console.warn);

  // FCM 푸시 알림 초기화 (백그라운드, 네이티브 앱에서만 동작)
  initPushNotifications().catch(console.warn);

  // Firebase Analytics 초기화 (백그라운드)
  initAnalytics().catch(console.warn);

  // 로컬 알림 초기화 + 기존 스케줄 복원
  initLocalNotifications().then(() => {
    if (state.timingResult) {
      _scheduleNativeReminders(state.timingResult);
    }
  }).catch(console.warn);

  // Health check 백그라운드 (UI 블로킹 없음)
  publicDataAPI.checkHealth()
    .then(connected => { state.apiConnected = connected; })
    .catch(() => { state.apiConnected = false; });
}

document.addEventListener('DOMContentLoaded', init);
