// ═══════════════════════════════════════════
// Image OCR Component - 영양제 라벨 이미지 → Gemini Vision → DB 매칭
// 서버 사이드 Gemini API를 통한 고정확도 한국어 인식
// ═══════════════════════════════════════════

import { CATEGORIES } from '../data/fallbackDB.js';
import { apiUrl } from '../utils/api.js';
import { showProductDetail } from './detail.js';

let capturedImageData = null;

export function renderCamera() {
  return `
    <div class="page active" id="page-camera">
      <div class="page-header">
        <h1>🔍 라벨 인식</h1>
        <p class="subtitle">영양제 라벨 사진을 올리면 AI가 자동으로 제품을 찾아줍니다</p>
      </div>
      <div class="page-content">
        <!-- 이미지 업로드 영역 -->
        <div class="upload-area" id="upload-area" onclick="document.getElementById('file-input').click()">
          <input type="file" accept="image/*" id="file-input" style="display:none;"
                 onchange="window.app.handleImageUpload(event)" />
          <div class="upload-placeholder" id="upload-placeholder">
            <div class="upload-icon">📸</div>
            <p class="upload-title">영양제 라벨 사진 선택</p>
            <p class="upload-desc">성분표 또는 제품명이 보이는 사진을 올려주세요</p>
            <span class="upload-btn">🖼️ 갤러리에서 선택</span>
          </div>
          <img id="upload-preview" class="upload-preview" style="display:none;" />
        </div>

        <!-- 재선택 / 인식 버튼 -->
        <div class="ocr-actions" id="ocr-actions" style="display:none;">
          <button class="btn-secondary" onclick="window.app.retakePhoto()">🔄 다시 선택</button>
          <button class="btn-primary" id="ocr-start-btn" onclick="window.app.startOCR()">🔍 AI 라벨 인식</button>
        </div>

        <!-- OCR 결과 영역 -->
        <div class="ocr-results" id="ocr-results" style="display:none;">
          <div class="ocr-status" id="ocr-status"></div>
          <div class="ocr-analysis" id="ocr-analysis" style="display:none;"></div>
          <div id="ocr-matches"></div>
        </div>

        <!-- 안내 카드 -->
        <div class="card animate-in ocr-tip-card" id="ocr-tip-card">
          <h3>💡 인식률 높이는 팁</h3>
          <ul class="ocr-tips">
            <li>제품명이 선명하게 보이는 사진을 사용하세요</li>
            <li>영양 성분표가 포함된 뒷면 사진도 효과적입니다</li>
            <li>흔들리거나 어두운 사진은 인식률이 낮을 수 있습니다</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// 라우터 호환용
export function initCamera() {}
export function destroyCamera() {}
export function capturePhoto() {}

export function handleImageUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // 파일 크기 체크 (5MB 제한)
  if (file.size > 5 * 1024 * 1024) {
    window.app.showToast('이미지 크기가 5MB를 초과합니다.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    capturedImageData = ev.target.result;

    const preview = document.getElementById('upload-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const actions = document.getElementById('ocr-actions');
    const results = document.getElementById('ocr-results');
    const tipCard = document.getElementById('ocr-tip-card');

    if (preview) {
      preview.src = capturedImageData;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (actions) actions.style.display = 'flex';
    if (results) results.style.display = 'none';
    if (tipCard) tipCard.style.display = 'none';

    const area = document.getElementById('upload-area');
    if (area) area.onclick = null;

    window.app.showToast('🖼️ 이미지 로드 완료!', 'success');
  };
  reader.readAsDataURL(file);
}

export function retakePhoto() {
  capturedImageData = null;

  const preview = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');
  const actions = document.getElementById('ocr-actions');
  const results = document.getElementById('ocr-results');
  const fileInput = document.getElementById('file-input');
  const tipCard = document.getElementById('ocr-tip-card');

  if (preview) preview.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  if (actions) actions.style.display = 'none';
  if (results) results.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (tipCard) tipCard.style.display = 'block';

  const area = document.getElementById('upload-area');
  if (area) area.onclick = () => document.getElementById('file-input').click();
}

export async function startOCR() {
  if (!capturedImageData) {
    window.app.showToast('이미지를 먼저 선택해주세요.', 'error');
    return;
  }

  const resultsArea = document.getElementById('ocr-results');
  const statusEl = document.getElementById('ocr-status');
  const analysisEl = document.getElementById('ocr-analysis');
  const matchesEl = document.getElementById('ocr-matches');
  const startBtn = document.getElementById('ocr-start-btn');

  if (resultsArea) resultsArea.style.display = 'block';
  if (startBtn) startBtn.disabled = true;
  if (statusEl) statusEl.innerHTML = `
    <div class="ocr-processing">
      <div class="spinner"></div>
      <span>AI가 라벨을 분석하고 있습니다...</span>
    </div>
  `;
  if (analysisEl) analysisEl.style.display = 'none';
  if (matchesEl) matchesEl.innerHTML = '';

  try {
    const res = await fetch(apiUrl('/api/ocr/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: capturedImageData }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '인식 실패');
    }

    // 분석 결과 표시
    if (statusEl) statusEl.innerHTML = `<div class="ocr-done">✅ AI 분석 완료</div>`;

    if (analysisEl && data.analysis) {
      const a = data.analysis;
      analysisEl.style.display = 'block';
      analysisEl.innerHTML = `
        <div class="ocr-analysis-card">
          <div class="ocr-analysis-row">
            <span class="ocr-label">제품명</span>
            <span class="ocr-value">${a.productName || '-'}</span>
          </div>
          <div class="ocr-analysis-row">
            <span class="ocr-label">브랜드</span>
            <span class="ocr-value">${a.brand || '-'}</span>
          </div>
          ${a.ingredients?.length ? `
            <div class="ocr-analysis-row">
              <span class="ocr-label">주요 성분</span>
              <span class="ocr-value">${a.ingredients.map(i => `<span class="tag">${i}</span>`).join(' ')}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    // 매칭 결과 표시
    _renderMatches(matchesEl, data.matches || [], data.searchTerms || []);

  } catch (err) {
    console.error('OCR 오류:', err);
    if (statusEl) statusEl.innerHTML = `
      <div class="ocr-error">❌ ${err.message}</div>
    `;
  } finally {
    if (startBtn) startBtn.disabled = false;
  }
}

function _renderMatches(container, matches, searchTerms) {
  if (!container) return;

  const addedIds = new Set((window.app?.getState()?.supplements || []).map(s => s.id));

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="ocr-no-match">
        <p>일치하는 제품을 찾지 못했습니다.</p>
        <button class="btn-secondary" onclick="window.app.navigate('search')">🔍 직접 검색하기</button>
      </div>
    `;
    return;
  }

  // OCR 매칭 결과를 전역에 저장 (상세보기용)
  window._ocrMatches = matches;

  container.innerHTML = `
    <h3 class="ocr-match-title">🎯 매칭된 제품 (${matches.length}건)</h3>
    <div class="ocr-match-list">
      ${matches.map((s, idx) => {
        const isAdded = addedIds.has(s.id);
        const categoryInfo = CATEGORIES[s.category] || CATEGORIES.vitamin;
        return `
          <div class="search-result-item ${isAdded ? 'added' : ''}"
               onclick="window._showOcrDetail(${idx})" style="cursor:pointer;">
            <div class="result-icon">${s.icon || categoryInfo.icon}</div>
            <div class="result-info">
              <div class="result-name">${s.name} ${isAdded ? '<span class="added-badge">추가됨</span>' : ''}</div>
              <div class="result-brand">${s.brand || ''}</div>
            </div>
            <div class="result-arrow">›</div>
          </div>
        `;
      }).join('')}
    </div>
    <button class="btn-secondary" style="width:100%;margin-top:12px;"
            onclick="window.app.navigate('search')">
      🔍 직접 검색하기
    </button>
  `;
}

// OCR 매칭 결과 → 상세 모달 열기 (검색 결과와 동일한 UX)
window._showOcrDetail = function(idx) {
  const matches = window._ocrMatches || [];
  const s = matches[idx];
  if (!s) return;
  showProductDetail(s);
};
