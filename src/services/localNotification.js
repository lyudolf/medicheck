// ═══════════════════════════════════════════
// Local Notification Service - 네이티브 복용 알림
// ═══════════════════════════════════════════

import { addNotification } from './notificationStore.js';

let localNotifModule = null;

/**
 * 로컬 알림 초기화 (Capacitor 네이티브 환경에서만 동작)
 */
export async function initLocalNotifications() {
  try {
    localNotifModule = await import('@capacitor/local-notifications');
    const { LocalNotifications } = localNotifModule;

    // 권한 요청
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      console.warn('[LocalNotif] 알림 권한 거부됨');
      return false;
    }

    // 알림 수신 리스너 (앱이 포그라운드일 때)
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('[LocalNotif] 알림 수신:', notification);
      // 알림 저장소에 기록
      addNotification(
        notification.title || '복용 알림',
        notification.body || ''
      );
    });

    // 알림 탭 리스너
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[LocalNotif] 알림 탭:', action);
      // 알림 저장소에 기록 (탭 통해 진입 시)
      const notif = action.notification;
      if (notif) {
        addNotification(
          notif.title || '복용 알림',
          notif.body || ''
        );
      }
      if (window.app?.navigate) {
        window.app.navigate('home');
      }
    });

    console.log('[LocalNotif] 초기화 완료');
    return true;
  } catch (e) {
    console.warn('[LocalNotif] 초기화 건너뜀 (웹 환경):', e.message);
    return false;
  }
}

/**
 * 복용 스케줄 기반 알림 등록
 * @param {Array} schedule - [{ slot: 'morning', time: '08:00', supplements: [{name}] }]
 */
export async function scheduleReminders(schedule) {
  if (!localNotifModule) return;
  const { LocalNotifications } = localNotifModule;

  // 기존 알림 전부 취소
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const enabled = localStorage.getItem('pillstack_noti_enabled') !== 'false'; // 기본 ON
  if (!enabled) {
    console.log('[LocalNotif] 알림 비활성화됨');
    return;
  }

  const SLOT_META = {
    morning: { emoji: '🌅', label: '아침' },
    evening: { emoji: '🌙', label: '저녁' },
    bedtime: { emoji: '😴', label: '취침 전' },
  };

  const notifications = [];
  let id = 1;

  for (const item of schedule) {
    if (!item.time || !item.supplements?.length) continue;

    const [hours, minutes] = item.time.split(':').map(Number);
    const meta = SLOT_META[item.slot] || { emoji: '💊', label: item.slot };
    const suppNames = item.supplements.map(s => s.name || s).join(', ');

    notifications.push({
      id: id++,
      title: `${meta.emoji} ${meta.label} 복용 시간`,
      body: `${suppNames}을(를) 복용할 시간입니다.`,
      schedule: {
        on: { hour: hours, minute: minutes },
        repeats: true,          // 매일 반복
        allowWhileIdle: true,   // Doze 모드에서도 알림
      },
      channelId: 'pillstack-reminders',
      smallIcon: 'ic_launcher',
      sound: 'default',
    });
  }

  if (notifications.length === 0) return;

  // 알림 채널 생성 (Android)
  try {
    await LocalNotifications.createChannel({
      id: 'pillstack-reminders',
      name: '복용 알림',
      description: '영양제 복용 시간 알림',
      importance: 4, // HIGH
      sound: 'default',
      vibration: true,
    });
  } catch (e) {
    // 채널 이미 존재하면 무시
  }

  await LocalNotifications.schedule({ notifications });
  console.log(`[LocalNotif] ${notifications.length}개 알림 등록됨`);
}

/**
 * 알림 ON/OFF 토글
 */
export function setNotificationEnabled(enabled) {
  localStorage.setItem('pillstack_noti_enabled', String(enabled));
}

/**
 * 알림 활성화 상태
 */
export function isNotificationEnabled() {
  return localStorage.getItem('pillstack_noti_enabled') !== 'false';
}
