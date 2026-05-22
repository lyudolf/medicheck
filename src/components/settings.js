// ═══════════════════════════════════════════
// Settings Component - 사용자 설정
// ═══════════════════════════════════════════

// ── Inline SVG Icons (stroke-based, 2px) ──
const ICONS = {
  // ⚙️ 설정 (페이지 타이틀) – gear
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,

  // 🚪 로그아웃 – log-out
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,

  // 🗑️ 데이터 초기화 – trash
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,

  // ⚠️ 계정 삭제 – alert-triangle
  alertTriangle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,

  // 🔔 복용 알림 – bell
  bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,

  // 버전 – info
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,

  // 개인정보 처리방침 – shield
  shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,

  // 이용약관 – file-text
  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,

  // ⚖️ 법적 고지 – scale / balance
  scale: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="1 12 5 8 9 12"/><polyline points="15 12 19 8 23 12"/><line x1="1" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="23" y2="12"/><line x1="5" y1="8" x2="19" y2="8"/></svg>`,

  // 📊 데이터 – bar-chart
  barChart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,

  // 🤖 AI – cpu
  cpu: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
};

export function renderSettings() {

  return `
    <div class="page active" id="page-settings">
      <div class="page-header">
        <h1>${ICONS.settings} 설정</h1>
        <p class="subtitle">앱 설정 및 정보</p>
      </div>
      <div class="page-content">

        <!-- 유저 프로필 -->
        <div class="settings-group animate-in">
          <div class="settings-group-title">계정</div>
          <div class="settings-item" id="user-profile-item">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${window.app?.getState()?.user?.user_metadata?.avatar_url || ''}"
                   alt="" style="width:36px;height:36px;border-radius:50%;background:var(--bg-glass);"
                   onerror="this.style.display='none'">
              <div>
                <div class="settings-label">${window.app?.getState()?.user?.user_metadata?.full_name || '사용자'}</div>
                <div class="settings-desc">${window.app?.getState()?.user?.email || ''}</div>
              </div>
            </div>
          </div>
          <div class="settings-item settings-logout-item" onclick="window.app.logout()">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="settings-logout-icon">${ICONS.logout}</span>
              <div class="settings-label">로그아웃</div>
            </div>
            <div class="result-arrow">›</div>
          </div>
        </div>

        <!-- 데이터 관리 -->
        <div class="settings-group animate-in">
          <div class="settings-group-title">데이터 관리</div>
          <div class="settings-item" onclick="window.app.clearAllData()">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-flex;flex-shrink:0;">${ICONS.trash}</span>
              <div>
                <div class="settings-label" style="color:var(--accent-red);">데이터 초기화</div>
                <div class="settings-desc">등록된 영양제 목록을 모두 삭제합니다</div>
              </div>
            </div>
            <div class="result-arrow">›</div>
          </div>
          <div class="settings-item" onclick="window.app.requestDeleteAccount()" style="border-top:1px solid rgba(255,80,80,0.15);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-flex;flex-shrink:0;">${ICONS.alertTriangle}</span>
              <div>
                <div class="settings-label" style="color:#ff4d4d;font-weight:600;">계정 삭제</div>
                <div class="settings-desc">탈퇴 요청 후 7일 뒤 모든 데이터가 영구 삭제됩니다</div>
              </div>
            </div>
            <div class="result-arrow">›</div>
          </div>
        </div>

        <!-- 알림 설정 -->
        <div class="settings-group animate-in animate-in-delay-1">
          <div class="settings-group-title">알림</div>
          <div class="settings-item">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-flex;flex-shrink:0;">${ICONS.bell}</span>
              <div>
                <div class="settings-label">복용 알림</div>
                <div class="settings-desc">설정한 시간에 복용 알림을 받습니다</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="noti-toggle"
                ${localStorage.getItem('pillstack_noti_enabled') !== 'false' ? 'checked' : ''}
                onchange="window.app.toggleNotification(this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 앱 정보 -->
        <div class="settings-group animate-in animate-in-delay-1">
          <div class="settings-group-title">앱 정보</div>
          <div class="settings-item">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-flex;flex-shrink:0;">${ICONS.info}</span>
              <div>
                <div class="settings-label">버전</div>
                <div class="settings-desc">PillStack v1.1.4</div>
              </div>
            </div>
          </div>
          <div class="settings-item" onclick="window.open('https://pillstack.kr/privacy.html', '_blank')">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-flex;flex-shrink:0;">${ICONS.shield}</span>
              <div>
                <div class="settings-label">개인정보 처리방침</div>
              </div>
            </div>
            <div class="result-arrow">›</div>
          </div>
          <div class="settings-item" onclick="window.open('https://pillstack.kr/terms.html', '_blank')">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="display:inline-flex;flex-shrink:0;">${ICONS.fileText}</span>
              <div>
                <div class="settings-label">이용약관</div>
              </div>
            </div>
            <div class="result-arrow">›</div>
          </div>
        </div>

        <!-- 면책 -->
        <div class="card animate-in animate-in-delay-3" style="margin-top:8px;">
          <p style="font-size:0.7rem;color:var(--text-muted);line-height:1.6;text-align:center;">
            ${ICONS.scale} <strong style="color:var(--text-secondary);">법적 고지</strong><br><br>
            PillStack은 <strong style="color:var(--text-secondary);">의료기기가 아니며</strong>, 제공되는 정보는 참고용입니다.<br>
            성분 분석은 AI 추론 기반이며, 의학적 판단을 대체하지 않습니다.<br>
            정확한 복용 상담은 의사 또는 약사에게 문의하세요.<br><br>
            ${ICONS.barChart} 데이터: 식품의약품안전처 공공데이터<br>
            ${ICONS.cpu} AI: Google Gemini 2.5 Flash<br><br>
            © 2026 PillStack
          </p>
        </div>
      </div>
    </div>
  `;
}
