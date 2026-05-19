// ═══════════════════════════════════════════
// Schedule Component - 복용 관리 페이지
// 저장된 분석 결과 기반 시간대별 타임피커
// ═══════════════════════════════════════════

import { loadReminders } from '../services/reminder.js';

const TIMING_KEY = 'medicheck_timing_result';

/**
 * 분석 결과(timingResult)를 localStorage에 영구 저장
 */
export function saveTimingResult(timingResult) {
  if (!timingResult) return;
  localStorage.setItem(TIMING_KEY, JSON.stringify(timingResult));
}

/**
 * 저장된 분석 결과 로드
 */
export function loadTimingResult() {
  try {
    const saved = localStorage.getItem(TIMING_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

export function renderSchedule() {
  const timing = loadTimingResult();

  if (!timing || !timing.schedule || timing.schedule.length === 0) {
    return `
      <div class="page active" id="page-schedule">
        <div class="page-header">
          <h1>⏰ 복용 관리</h1>
          <p class="subtitle">복용 시간을 설정하고 알림을 관리하세요</p>
        </div>
        <div class="page-content">
          <div class="empty-state animate-in">
            <div class="empty-icon">📋</div>
            <h2>분석 결과가 없습니다</h2>
            <p>홈에서 영양제를 2개 이상 등록하고 성분 분석을 실행하면, 추천 복용 스케줄이 여기에 저장됩니다.</p>
            <button class="btn-primary" onclick="window.app.navigate('home')">
              <span>🏠</span> 홈으로 이동
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const reminders = loadReminders();
  const slotMap = { '아침': 'morning', '저녁': 'evening', '취침 전': 'bedtime' };

  return `
    <div class="page active" id="page-schedule">
      <div class="page-header">
        <h1>⏰ 복용 관리</h1>
        <p class="subtitle">복용 시간을 설정하고 알림을 관리하세요</p>
      </div>
      <div class="page-content">

        <!-- 시간대별 설정 카드 -->
        <div class="section-title animate-in">
          <span class="section-icon">🕐</span>
          복용 시간 설정
        </div>

        ${timing.schedule.map((slot, i) => {
          const slotKey = slotMap[slot.label] || 'morning';
          const savedTime = reminders[slotKey] || '08:00';
          const slotEmoji = slotKey === 'morning' ? '🌅' : slotKey === 'evening' ? '🌙' : '😴';

          return `
            <div class="schedule-manage-card animate-in animate-in-delay-${i + 1}">
              <div class="schedule-manage-header">
                <div class="schedule-manage-label">
                  <span class="schedule-manage-emoji">${slotEmoji}</span>
                  <div>
                    <div class="schedule-manage-title">${slot.time}</div>
                    <div class="schedule-manage-desc">${slot.supplements.length}개 영양제</div>
                  </div>
                </div>
                <button class="time-picker-btn" onclick="window.app.openTimePicker('${slotKey}', '${savedTime}')">
                  <span class="time-picker-display">${savedTime}</span>
                  <span class="time-picker-icon">🕐</span>
                </button>
              </div>
              <div class="schedule-manage-pills">
                ${slot.supplements.map(s => `
                  <div class="schedule-manage-pill">
                    <span>${s.icon}</span>
                    <span>${s.name}</span>
                    <span class="pill-food-tag">${s.withFood ? '🍽️식후' : '공복'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <!-- 팁 -->
        ${timing.notes?.length > 0 ? `
          <div class="section-title animate-in" style="margin-top:24px;">
            <span class="section-icon">💡</span>
            복용 팁
          </div>
          ${timing.notes.map(note => `
            <div class="card animate-in" style="margin-bottom:8px;font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
              ${note}
            </div>
          `).join('')}
        ` : ''}

        <div class="reminder-save-hint animate-in" style="margin-top:16px;">
          <span>⏰</span> 설정한 시간에 맞춰 복용 알림이 전송됩니다
        </div>

        <div style="height:20px;"></div>
      </div>
    </div>
  `;
}
