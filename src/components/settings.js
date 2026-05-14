// ═══════════════════════════════════════════
// Settings Component - 사용자 설정
// ═══════════════════════════════════════════

export function renderSettings() {

  return `
    <div class="page active" id="page-settings">
      <div class="page-header">
        <h1>⚙️ 설정</h1>
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
          <div class="settings-item" style="justify-content:center;">
            <button class="btn btn-outline" style="width:100%;padding:10px;" onclick="window.app.logout()">로그아웃</button>
          </div>
        </div>

        <!-- 데이터 관리 -->
        <div class="settings-group animate-in">
          <div class="settings-group-title">데이터 관리</div>
          <div class="settings-item" onclick="window.app.clearAllData()">
            <div>
              <div class="settings-label" style="color:var(--accent-red);">🗑️ 데이터 초기화</div>
              <div class="settings-desc">등록된 영양제 목록을 모두 삭제합니다</div>
            </div>
            <div class="result-arrow">›</div>
          </div>
          <div class="settings-item" onclick="window.app.requestDeleteAccount()" style="border-top:1px solid rgba(255,80,80,0.15);">
            <div>
              <div class="settings-label" style="color:#ff4d4d;font-weight:600;">⚠️ 계정 삭제</div>
              <div class="settings-desc">탈퇴 요청 후 7일 뒤 모든 데이터가 영구 삭제됩니다</div>
            </div>
            <div class="result-arrow">›</div>
          </div>
        </div>

        <!-- 앱 정보 -->
        <div class="settings-group animate-in animate-in-delay-1">
          <div class="settings-group-title">앱 정보</div>
          <div class="settings-item">
            <div>
              <div class="settings-label">버전</div>
              <div class="settings-desc">PillStack v1.0.0</div>
            </div>
          </div>
        </div>

        <!-- 면책 -->
        <div class="card animate-in animate-in-delay-3" style="margin-top:8px;">
          <p style="font-size:0.7rem;color:var(--text-muted);line-height:1.6;text-align:center;">
            ⚖️ <strong style="color:var(--text-secondary);">법적 고지</strong><br><br>
            PillStack은 <strong style="color:var(--text-secondary);">의료기기가 아니며</strong>, 제공되는 정보는 참고용입니다.<br>
            성분 분석은 AI 추론 기반이며, 의학적 판단을 대체하지 않습니다.<br>
            정확한 복용 상담은 의사 또는 약사에게 문의하세요.<br><br>
            📊 데이터: 식품의약품안전처 공공데이터<br>
            🤖 AI: Google Gemini 2.5 Flash<br><br>
            © 2026 PillStack
          </p>
        </div>
      </div>
    </div>
  `;
}
