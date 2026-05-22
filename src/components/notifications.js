// ═══════════════════════════════════════════
// Notification Center — 알림 센터 UI
// ═══════════════════════════════════════════

import { getNotifications, markAsRead, markAllAsRead, clearAll, getUnreadCount } from '../services/notificationStore.js';

/**
 * 상대 시간 문자열 반환
 * @param {number} timestamp - Unix timestamp (ms)
 * @returns {string} 예: '방금', '5분 전', '1시간 전', '어제'
 */
function relativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (diff < MIN) return '방금';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  if (diff < 2 * DAY) return '어제';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}일 전`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 알림 센터 페이지 HTML 렌더
 * @returns {string} HTML
 */
export function renderNotifications() {
  const notifications = getNotifications();
  const unreadCount = getUnreadCount();

  const headerHTML = `
    <div class="notif-center-header">
      <h2 class="notif-center-title">🔔 알림</h2>
      <div class="notif-center-actions">
        ${unreadCount > 0 ? `
          <button class="notif-action-btn" onclick="window.app.markAllNotificationsRead()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            모두 읽음
          </button>
        ` : ''}
        ${notifications.length > 0 ? `
          <button class="notif-action-btn notif-action-danger" onclick="window.app.clearAllNotifications()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            전체 삭제
          </button>
        ` : ''}
      </div>
    </div>
  `;

  let listHTML = '';

  if (notifications.length === 0) {
    listHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">🔕</div>
        <div class="notif-empty-text">알림이 없습니다</div>
        <div class="notif-empty-sub">복용 알림이나 푸시 알림이 여기에 표시됩니다</div>
      </div>
    `;
  } else {
    listHTML = `
      <div class="notif-list">
        ${notifications.map(n => `
          <div class="notif-card ${n.read ? 'read' : 'unread'}" onclick="window.app.markNotificationRead('${n.id}')">
            ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
            <div class="notif-card-content">
              <div class="notif-card-header">
                <span class="notif-card-title">${_escapeHTML(n.title)}</span>
                <span class="notif-card-time">${relativeTime(n.timestamp)}</span>
              </div>
              <div class="notif-card-body">${_escapeHTML(n.body)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="notif-center">
      ${headerHTML}
      ${listHTML}
    </div>
  `;
}

/**
 * HTML 이스케이프 유틸
 */
function _escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
