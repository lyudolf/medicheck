// ═══════════════════════════════════════════
// Notification Store — localStorage 기반 알림 저장소
// ═══════════════════════════════════════════

const STORAGE_KEY = 'pillstack_notifications';
const MAX_NOTIFICATIONS = 50;

/**
 * localStorage에서 알림 목록 로드
 */
function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[NotifStore] 로드 실패:', e);
    return [];
  }
}

/**
 * localStorage에 알림 목록 저장
 */
function _save(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.warn('[NotifStore] 저장 실패:', e);
  }
}

/**
 * 새 알림 추가 (FIFO, 최대 50개)
 * @param {string} title - 알림 제목
 * @param {string} body - 알림 내용
 * @returns {object} 생성된 알림 객체
 */
export function addNotification(title, body) {
  const notifications = _load();
  const notification = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title,
    body,
    timestamp: Date.now(),
    read: false,
  };

  // 최신 순 (앞에 추가)
  notifications.unshift(notification);

  // 최대 개수 초과 시 오래된 것 제거 (FIFO)
  while (notifications.length > MAX_NOTIFICATIONS) {
    notifications.pop();
  }

  _save(notifications);

  // 뱃지 업데이트 이벤트 발행
  _dispatchBadgeUpdate();

  return notification;
}

/**
 * 전체 알림 목록 반환 (최신순)
 * @returns {Array} 알림 배열
 */
export function getNotifications() {
  return _load();
}

/**
 * 특정 알림 읽음 처리
 * @param {string} id - 알림 ID
 */
export function markAsRead(id) {
  const notifications = _load();
  const notif = notifications.find(n => n.id === id);
  if (notif) {
    notif.read = true;
    _save(notifications);
    _dispatchBadgeUpdate();
  }
}

/**
 * 전체 알림 읽음 처리
 */
export function markAllAsRead() {
  const notifications = _load();
  notifications.forEach(n => { n.read = true; });
  _save(notifications);
  _dispatchBadgeUpdate();
}

/**
 * 전체 알림 삭제
 */
export function clearAll() {
  _save([]);
  _dispatchBadgeUpdate();
}

/**
 * 읽지 않은 알림 수
 * @returns {number}
 */
export function getUnreadCount() {
  return _load().filter(n => !n.read).length;
}

/**
 * 뱃지 업데이트 커스텀 이벤트 발행
 */
function _dispatchBadgeUpdate() {
  try {
    window.dispatchEvent(new CustomEvent('pillstack:notification-update', {
      detail: { unreadCount: getUnreadCount() },
    }));
  } catch (e) {
    // 무시
  }
}
