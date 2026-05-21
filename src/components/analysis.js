// ═══════════════════════════════════════════
// Analysis Component - 분석 결과 대시보드
// v2: summary → optimizedRoutine → technicalAnalysis
// ═══════════════════════════════════════════

import { loadReminders } from '../services/reminder.js';

export function renderAnalysis(analysisResult, timingResult) {
  if (!analysisResult) {
    const suppCount = window.app?.getState()?.supplements?.length || 0;
    const canAnalyze = suppCount >= 2;
    return `<div class="page active" id="page-analysis">
      <div class="page-header">
        <h1>🔬 분석</h1>
      </div>
      <div class="page-content">
        <div class="empty-state" style="padding:48px 24px;">
          <div style="font-size:3.5rem;margin-bottom:20px;opacity:0.8;">🧬</div>
          <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:10px;">
            ${suppCount === 0 ? '영양제를 먼저 등록해주세요' : suppCount === 1 ? '영양제 1개가 등록됨' : `영양제 ${suppCount}개 등록됨`}
          </h2>
          <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;margin-bottom:28px;">
            ${suppCount < 2
              ? '홈에서 영양제를 2개 이상 등록하면\n병용 시너지 · 결핍 체크 · 복용 스케줄을\nAI가 분석해드려요.'
              : `${suppCount}개의 영양제를 분석할 준비가 됐어요.\n아래 버튼을 눌러 결과를 확인하세요.`}
          </p>
          ${canAnalyze ? `
            <button class="btn-primary" onclick="window.app.startAnalysis()" style="max-width:280px;margin:0 auto;">
              🔍 성분 분석 시작하기
            </button>
          ` : `
            <button class="btn-cta-secondary" onclick="window.app.navigate('search')" style="max-width:280px;margin:0 auto;">
              + 영양제 검색하기
            </button>
          `}
        </div>
      </div>
    </div>`;
  }

  const { score, interactions, conflictCount, synergyCount, summary, ingredientAnalysis } = analysisResult;
  const scoreClass = score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad';

  // 새 구조 데이터 추출
  const geminiSummary = ingredientAnalysis?.summary || {};
  const techAnalysis = ingredientAnalysis?.technicalAnalysis || [];
  const optimizedRoutine = ingredientAnalysis?.optimizedRoutine || [];
  const deficiencies = ingredientAnalysis?.deficiencies || [];
  const extractedNutrients = ingredientAnalysis?.extractedNutrients || [];

  const missingCount = deficiencies.filter(d => d.status === 'missing').length;
  const critCount = techAnalysis.filter(t => t.level === 'critical').length;
  const cautCount = techAnalysis.filter(t => t.level === 'caution').length;

  // 점수 (Gemini healthScore 우선, 없으면 로컬 score)
  const displayScore = geminiSummary.healthScore || score;
  const displayScoreClass = displayScore >= 80 ? 'good' : displayScore >= 60 ? 'warn' : 'bad';
  const scoreGrade = displayScore >= 90 ? '매우 좋음' : displayScore >= 80 ? '좋음' : displayScore >= 60 ? '개선 필요' : '주의 필요';

  // Gemini summary 또는 로컬 fallback
  const headlineText = geminiSummary.headline || summary || '';
  const keyActionText = geminiSummary.keyAction || '';

  // 시간표: Gemini optimizedRoutine 우선, 없으면 기존 timingResult
  const hasOptimizedRoutine = optimizedRoutine.length > 0;

  return `
    <div class="page active" id="page-analysis">
      <div class="page-header">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <h1>🔬 분석 결과</h1>
          <button class="modal-close" onclick="window.app.navigate('home')">✕</button>
        </div>
      </div>
      <div class="page-content">
        <!-- Score Circle -->
        <div class="analysis-header animate-in">
          <div class="score-circle ${displayScoreClass}">
            <span class="score-label">${scoreGrade}</span>
            <span class="score-value">${displayScore}</span>
            <span class="score-max">/ 100</span>
          </div>
        </div>

        <!-- Summary Card (새 구조) -->
        ${headlineText ? `
        <div class="card animate-in animate-in-delay-1" style="margin-bottom:16px;background:var(--card-gradient,var(--card-bg));border:1px solid rgba(99,102,241,0.2);">
          <div style="font-size:0.85rem;font-weight:600;line-height:1.6;margin-bottom:${keyActionText ? '10px' : '0'};">${headlineText}</div>
          ${keyActionText ? `
            <div style="display:flex;align-items:flex-start;gap:8px;font-size:0.78rem;color:var(--accent);background:rgba(99,102,241,0.08);border-radius:10px;padding:10px 12px;">
              <span>👉</span>
              <span>${keyActionText}</span>
            </div>
          ` : ''}
        </div>
        ` : `
        <p style="color:var(--text-secondary);font-size:0.85rem;margin:0 0 16px;text-align:center;">${summary}</p>
        `}

        <!-- Stats -->
        <div style="display:flex;gap:8px;margin-bottom:20px;" class="animate-in animate-in-delay-1">
          <div class="card" style="flex:1;text-align:center;">
            <div style="font-size:1.5rem;">⚠️</div>
            <div style="font-size:1.2rem;font-weight:700;margin-top:4px;">${conflictCount}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">주의 사항</div>
          </div>
          <div class="card" style="flex:1;text-align:center;">
            <div style="font-size:1.5rem;">✅</div>
            <div style="font-size:1.2rem;font-weight:700;margin-top:4px;">${synergyCount}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">시너지 효과</div>
          </div>
          <div class="card" style="flex:1;text-align:center;">
            <div style="font-size:1.5rem;">💊</div>
            <div style="font-size:1.2rem;font-weight:700;margin-top:4px;">${window.app?.getState()?.supplements?.length || 0}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">등록 영양제</div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="analysis-tabs animate-in animate-in-delay-2">
          <button class="analysis-tab active" data-tab="schedule" onclick="window.app.switchAnalysisTab('schedule')">
            ⏰ 복용 스케줄
          </button>
          <button class="analysis-tab" data-tab="deep" onclick="window.app.switchAnalysisTab('deep')">
            🧪 심층 분석
          </button>
          <button class="analysis-tab" data-tab="deficiency" onclick="window.app.switchAnalysisTab('deficiency')">
            🧬 결핍 체크 ${missingCount > 0 ? '<span class="tab-badge">' + missingCount + '</span>' : ''}
          </button>
        </div>

        <!-- Tab: 복용 스케줄 -->
        <div class="analysis-tab-content" id="tab-schedule">
          ${hasOptimizedRoutine ? _renderOptimizedRoutine(optimizedRoutine) : (
            timingResult ? `
              <div class="schedule-section animate-in">
                <h3><span>⏰</span> 추천 복용 스케줄</h3>
                <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
                  시간을 탭하여 복용 알림을 설정하세요.
                </p>
                ${_renderTimeline(timingResult)}
                ${timingResult.notes?.length > 0 ? `
                  <div style="margin-top:16px;">
                    ${timingResult.notes.map((note) => `
                      <div class="card" style="margin-bottom:8px;font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
                        ${note}
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="empty-state" style="padding:40px 0;">
                <div style="font-size:2rem;margin-bottom:12px;">⏰</div>
                <p>복용 스케줄이 없습니다.<br>홈에서 분석을 실행하면 자동 생성됩니다.</p>
              </div>
            `
          )}
        </div>

        <!-- Tab: 심층 분석 -->
        <div class="analysis-tab-content" id="tab-deep" style="display:none;">
          <!-- 로컬 DB + DUR 상호작용 -->
          ${interactions.length > 0 ? `
            <div class="section-title animate-in animate-in-delay-2">
              <span class="section-icon">🔗</span>
              성분 상호작용
            </div>
            <div class="interaction-list">
              ${interactions.map((item, i) => _renderInteractionCard(item, i)).join('')}
            </div>
          ` : ''}

          <!-- Gemini AI Triage 분석 -->
          ${_renderTechnicalAnalysis(techAnalysis, extractedNutrients, ingredientAnalysis?.source)}
        </div>

        <!-- Tab: 결핍 영양소 -->
        <div class="analysis-tab-content" id="tab-deficiency" style="display:none;">
          ${_renderDeficiencyTab(deficiencies)}
        </div>

        <div style="height:20px;"></div>
      </div>
    </div>
  `;
}

function _renderInteractionCard(item, index) {
  const typeClass = item.type === 'synergy' ? 'synergy' : (item.severity === 'warning' ? 'danger' : 'caution');
  const badge = item.type === 'synergy' ? '✅' : (item.severity === 'warning' ? '🔴' : '🟡');

  return `
    <div class="interaction-card ${typeClass} animate-in" style="animation-delay:${0.1 * index}s; opacity:0;">
      <div class="interaction-header">
        <div class="interaction-badge">${badge}</div>
        <div>
          <div class="interaction-title">${item.title}</div>
          <div class="interaction-subtitle">
            ${item.sourceA || ''} ${item.sourceA && item.sourceB ? '↔' : ''} ${item.sourceB || ''}
          </div>
        </div>
      </div>
      <div class="interaction-body">${item.description}</div>
      ${item.tip ? `
        <div class="interaction-tip">
          <span class="tip-icon">💡</span>
          <span>${item.tip}</span>
        </div>
      ` : ''}
      ${item.fromAPI ? `
        <div style="margin-top:8px;">
          <span class="tag" style="background:rgba(59,130,246,0.15);color:var(--accent-blue);border-color:rgba(59,130,246,0.3);">🌐 공공데이터 DUR</span>
        </div>
      ` : ''}
    </div>
  `;
}

// ─── Gemini Optimized Routine 렌더 ───
function _renderOptimizedRoutine(routine) {
  const reminders = loadReminders();
  const slotMap = { '아침': 'morning', '오전': 'morning', '저녁': 'evening', '오후': 'evening', '취침': 'bedtime' };

  function getSlotKey(time) {
    for (const [key, val] of Object.entries(slotMap)) {
      if (time.includes(key)) return val;
    }
    return 'morning';
  }

  const timeIcons = { morning: '🌅', evening: '🌙', bedtime: '😴' };
  const timeLabels = { morning: '아침', evening: '저녁', bedtime: '취침 전' };

  return `
    <div class="schedule-section animate-in">
      <h3><span>⏰</span> AI 맞춤 복용 시간표</h3>
      <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
        성분 충돌을 피하도록 AI가 최적의 시간대를 배치했습니다.
      </p>
      <div class="timeline">
        ${routine.map((slot) => {
          const slotKey = getSlotKey(slot.time);
          const savedTime = reminders[slotKey] || '08:00';
          const icon = timeIcons[slotKey] || '💊';
          return `
            <div class="timeline-item">
              <div class="time-label-row">
                <div class="time-label">${icon} ${slot.time}</div>
                <div class="time-picker-wrap">
                  <button class="time-picker-btn" onclick="window.app.openTimePicker('${slotKey}', '${savedTime}')">
                    <span class="time-picker-display">${savedTime}</span>
                    <span class="time-picker-icon">🕐</span>
                  </button>
                </div>
              </div>
              <div class="time-supplements">
                ${slot.products.map(p => `
                  <div class="time-pill">
                    <span class="pill-icon">💊</span>
                    <span>${p}</span>
                  </div>
                `).join('')}
              </div>
              ${slot.note ? `
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;line-height:1.5;padding-left:4px;">
                  💡 ${slot.note}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div class="reminder-save-hint animate-in">
        <span>⏰</span> 시간을 설정하면 복용 알림에 반영됩니다
      </div>
    </div>
  `;
}

// ─── Gemini Technical Analysis (Triage) 렌더 ───
function _renderTechnicalAnalysis(techAnalysis, extractedNutrients, source) {
  if (!techAnalysis || techAnalysis.length === 0) {
    if (source === 'none') {
      return `
        <div class="card animate-in" style="margin-bottom:20px;opacity:0.6;">
          <div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:var(--text-muted);">
            <span>🤖</span>
            <span>Gemini 성분 분석 미설정 — 서버 .env에 GEMINI_API_KEY를 추가하면 상세 분석이 표시됩니다.</span>
          </div>
        </div>`;
    }
    return '';
  }

  const triageLabel = { critical: '🚨 위험', caution: '⚡ 주의', info: '💡 참고' };
  const triageClass = { critical: 'danger', caution: 'caution', info: 'synergy' };

  return `
    <div class="section-title animate-in animate-in-delay-2">
      <span class="section-icon">🤖</span>
      AI 성분 심층 분석
    </div>

    ${techAnalysis.map((t, i) => `
      <div class="interaction-card ${triageClass[t.level] || 'caution'} animate-in" style="animation-delay:${0.1*i}s;opacity:0;">
        <div class="interaction-header">
          <div class="interaction-badge" style="font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:4px;background:${
            t.level === 'critical' ? 'rgba(248,113,113,0.2)' : t.level === 'caution' ? 'rgba(251,191,36,0.2)' : 'rgba(96,165,250,0.15)'
          };color:${
            t.level === 'critical' ? 'var(--danger)' : t.level === 'caution' ? 'var(--warning)' : 'var(--accent-blue)'
          };">${triageLabel[t.level] || t.level}</div>
          <div>
            <div class="interaction-title">${t.title}</div>
            <div class="interaction-subtitle">${(t.products || []).join(' + ')}</div>
          </div>
        </div>
        <div class="interaction-body">${t.detail}</div>
        ${t.action ? `
          <div class="interaction-tip">
            <span class="tip-icon">→</span>
            <span style="font-weight:500;">${t.action}</span>
          </div>
        ` : ''}
      </div>
    `).join('')}

    ${extractedNutrients && extractedNutrients.length > 0 ? `
      <div class="card animate-in" style="margin:16px 0 12px;">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">📋 추출된 핵심 성분</div>
        ${extractedNutrients.map(p => `
          <div style="margin-bottom:6px;">
            <span style="font-size:0.75rem;color:var(--text-secondary);">${p.product}</span><br>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
              ${(p.nutrients || []).map(n => `<span class="tag">${n}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="card" style="margin-bottom:20px;font-size:0.72rem;color:var(--text-muted);line-height:1.6;">
      🤖 AI 분석 결과는 참고용입니다. 정확한 복용 상담은 약사 또는 의사에게 확인하세요.
    </div>
  `;
}

function _renderTimeline(timing) {
  if (!timing.schedule || timing.schedule.length === 0) return '';

  const reminders = loadReminders();
  const slotMap = { '아침': 'morning', '저녁': 'evening', '취침 전': 'bedtime' };

  return `
    <div class="timeline">
      ${timing.schedule.map((slot) => {
        const slotKey = slotMap[slot.label] || 'morning';
        const savedTime = reminders[slotKey] || '08:00';
        return `
        <div class="timeline-item">
          <div class="time-label-row">
            <div class="time-label">${slot.time}</div>
            <div class="time-picker-wrap">
              <button class="time-picker-btn" onclick="window.app.openTimePicker('${slotKey}', '${savedTime}')">
                <span class="time-picker-display">${savedTime}</span>
                <span class="time-picker-icon">🕐</span>
              </button>
            </div>
          </div>
          <div class="time-supplements">
            ${slot.supplements.length > 0 ? slot.supplements.map((s) => `
              <div class="time-pill">
                <span class="pill-icon">${s.icon}</span>
                <span>${s.name}</span>
                ${s.withFood ? '<span style="font-size:0.65rem;color:var(--text-muted);">🍽️식후</span>' : '<span style="font-size:0.65rem;color:var(--text-muted);">공복</span>'}
              </div>
            `).join('') : '<span style="font-size:0.8rem;color:var(--text-muted);">해당 없음</span>'}
          </div>
        </div>
      `;}).join('')}
    </div>
    <div class="reminder-save-hint animate-in">
      <span>⏰</span> 시간을 설정하면 복용 알림에 반영됩니다
    </div>
  `;
}

function _renderDeficiencyTab(deficiencies) {
  if (!deficiencies || deficiencies.length === 0) {
    return `
      <div class="empty-state" style="padding:40px 0;">
        <div style="font-size:2rem;margin-bottom:12px;">🧬</div>
        <p>영양소 분석 결과가 없습니다.<br>홈에서 "성분 분석하기"를 실행해주세요.</p>
      </div>
    `;
  }

  const sufficient = deficiencies.filter(d => d.status === 'sufficient');
  const partial = deficiencies.filter(d => d.status === 'partial');
  const missing = deficiencies.filter(d => d.status === 'missing');

  return `
    <div class="ia-section-title" style="margin-bottom:12px;">
      <span>🧬</span> 핵심 6대 영양소 체크
    </div>
    <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
      등록된 영양제를 기준으로 핵심 영양소의 섭취 여부를 분석했어요.
    </p>

    ${missing.length > 0 ? `
      <div class="deficiency-section-label missing-label">🔴 미섭취 영양소 (${missing.length})</div>
      <div class="deficiency-grid">
        ${missing.map((d, i) => _renderDeficiencyCard(d, i)).join('')}
      </div>
    ` : ''}

    ${partial.length > 0 ? `
      <div class="deficiency-section-label partial-label">🟡 부분 충족 (${partial.length})</div>
      <div class="deficiency-grid">
        ${partial.map((d, i) => _renderDeficiencyCard(d, i)).join('')}
      </div>
    ` : ''}

    ${sufficient.length > 0 ? `
      <div class="deficiency-section-label sufficient-label">✅ 충족 (${sufficient.length})</div>
      <div class="deficiency-grid">
        ${sufficient.map((d, i) => _renderDeficiencyCard(d, i)).join('')}
      </div>
    ` : ''}

    <div class="card" style="margin-top:16px;font-size:0.72rem;color:var(--text-muted);line-height:1.6;">
      🤖 AI 분석 기반 참고 정보입니다. 개인별 건강 상태에 따라 다를 수 있으니 전문가와 상담하세요.
    </div>
  `;
}

function _renderDeficiencyCard(d, i) {
  const statusIcon = d.status === 'sufficient' ? '✅' : d.status === 'partial' ? '🟡' : '🔴';
  const statusLabel = d.status === 'sufficient' ? '충족' : d.status === 'partial' ? '부분 충족' : '미섭취';
  const statusClass = d.status;
  return `
    <div class="deficiency-card ${statusClass} animate-in" style="animation-delay:${0.08*i}s;opacity:0;">
      <div class="deficiency-header">
        <span class="deficiency-icon">${statusIcon}</span>
        <div>
          <div class="deficiency-name">${d.nutrient}</div>
          <div class="deficiency-rda">${d.dailyRecommended || ''}</div>
        </div>
        <span class="deficiency-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      ${d.coveringProducts && d.coveringProducts.length > 0 ? `
        <div class="deficiency-products">📦 ${d.coveringProducts.join(', ')}</div>
      ` : ''}
      ${d.recommendation ? `
        <div class="deficiency-rec">💡 ${d.recommendation}</div>
      ` : ''}
    </div>`;
}
