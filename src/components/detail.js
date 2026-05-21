// ═══════════════════════════════════════════
// Product Detail - 영양제 상세 정보 모달
// 공공데이터 API에서 기능성/섭취방법/주의사항 로드
// ═══════════════════════════════════════════

import { getSupplementIcon } from '../utils/icons.js';
import { CATEGORIES } from '../data/fallbackDB.js';
import { apiUrl } from '../utils/api.js';

let currentProduct = null;
let detailData = null;
let isLoadingDetail = false;
let isShelfView = false;

export function showProductDetail(product, fromShelf = false) {
  currentProduct = product;
  detailData = null;
  isLoadingDetail = true;
  isShelfView = fromShelf;

  // 모달 렌더
  const existing = document.getElementById('detail-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'detail-modal';
  modal.innerHTML = _renderDetailModal();
  document.body.appendChild(modal);

  // 애니메이션
  requestAnimationFrame(() => modal.querySelector('.detail-overlay').classList.add('active'));

  // API에서 상세 정보 로드
  if (product.registNo) {
    _fetchDetail(product.registNo);
  } else {
    isLoadingDetail = false;
    _updateDetailContent();
  }
}

export function closeProductDetail() {
  const modal = document.getElementById('detail-modal');
  if (modal) {
    const overlay = modal.querySelector('.detail-overlay');
    overlay.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
  currentProduct = null;
  detailData = null;
}

async function _fetchDetail(registNo) {
  try {
    const res = await fetch(apiUrl(`/api/supplements/detail?registNo=${registNo}`));
    const data = await res.json();
    detailData = data.item;
  } catch (err) {
    console.warn('상세 정보 로드 실패:', err);
    detailData = null;
  } finally {
    isLoadingDetail = false;
    _updateDetailContent();
  }
}

function _updateDetailContent() {
  const container = document.getElementById('detail-content');
  if (!container) return;
  container.innerHTML = _renderDetailContent();
}

function _renderDetailModal() {
  const p = currentProduct;
  const catInfo = CATEGORIES[p.category] || { icon: '💊', label: '기타' };

  return `
    <div class="detail-overlay" onclick="if(event.target===this) window.app.closeDetail()">
      <div class="detail-sheet">
        <div class="modal-handle"></div>

        <!-- 헤더 -->
        <div class="detail-header">
          <div class="detail-icon-wrap">
            <span class="detail-icon">${getSupplementIcon(p.icon)}</span>
          </div>
          <div class="detail-title-area">
            <h2 class="detail-title">${p.name}</h2>
            <p class="detail-brand">${p.brand}</p>
            <div class="detail-tags">
              <span class="tag tag-${p.category}">${catInfo.icon} ${catInfo.label}</span>
              ${p.source === 'api' ? '<span class="tag">🌐 공공데이터</span>' : ''}
              ${p.registNo ? `<span class="tag">📋 ${p.registNo}</span>` : ''}
            </div>
          </div>
          <button class="modal-close" onclick="window.app.closeDetail()">✕</button>
        </div>

        <!-- 콘텐츠 영역 -->
        <div class="detail-body" id="detail-content">
          <div class="detail-loading">
            <div class="spinner"></div>
            <span>상세 정보를 불러오는 중...</span>
          </div>
        </div>

        <!-- 하단 액션 -->
        <div class="detail-actions">
          ${isShelfView ? `
            <a class="btn-coupang" href="https://www.coupang.com/np/search?component=&q=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">
              🛒 쿠팡에서 검색
            </a>
            <p class="coupang-disclaimer">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.</p>
          ` : `
            <button class="btn-primary" id="detail-add-btn"
                    onclick="window.app.addFromDetail()">
              ➕ 내 선반에 추가
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function _renderDetailContent() {
  const p = currentProduct;
  const d = detailData;

  // 상세 API 데이터가 있는 경우
  if (d) {
    const sections = [];

    if (d.mainFunction) {
      sections.push(_section('💊 주요 기능성', _formatMultiline(d.mainFunction)));
    }
    if (d.intake) {
      sections.push(_section('📋 섭취 방법', _formatMultiline(d.intake)));
    }
    if (d.caution) {
      sections.push(_section('⚠️ 섭취 주의사항', _formatMultiline(d.caution), 'caution'));
    }
    if (d.appearance) {
      sections.push(_section('🔬 성상', d.appearance));
    }
    if (d.shelfLife) {
      sections.push(_section('📅 유통기한', d.shelfLife));
    }
    if (d.preservation) {
      sections.push(_section('🧊 보관법', d.preservation));
    }

    if (sections.length === 0) {
      sections.push('<div class="detail-empty">상세 정보가 등록되지 않은 제품입니다.</div>');
    }

    return `
      <div class="detail-source">🌐 공공데이터포털 건강기능식품 API</div>
      ${isShelfView ? _renderInventorySection() : ''}
      ${sections.join('')}
    `;
  }

  // API 데이터 없는 경우
  if (!isLoadingDetail) {
    const fallback = [];
    if (p.ingredients?.length) {
      fallback.push(_section('💊 포함 성분',
        `<div class="detail-chips">${p.ingredients.map(i => `<span class="detail-chip">${i}</span>`).join('')}</div>`
      ));
    }
    fallback.push('<div class="detail-empty">상세 정보를 불러올 수 없습니다.</div>');
    return fallback.join('');
  }

  return `
    <div class="detail-loading">
      <div class="spinner"></div>
      <span>상세 정보를 불러오는 중...</span>
    </div>
  `;
}

function _section(title, content, type = '') {
  return `
    <div class="detail-section ${type ? 'detail-section-' + type : ''}">
      <h3 class="detail-section-title">${title}</h3>
      <div class="detail-section-content">${content}</div>
    </div>
  `;
}

function _formatMultiline(text) {
  if (!text) return '';
  // 번호 매기기 패턴 유지하면서 줄바꿈 처리
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<p>${l.trim()}</p>`)
    .join('');
}

export function getCurrentProduct() {
  return currentProduct;
}

function _renderInventorySection() {
  const p = currentProduct;
  if (!p) return '';
  const total = p.totalPills || 60;
  const dosage = p.dosagePerTake || 1;
  const remaining = p.remainingPills ?? total;
  const pct = Math.round((remaining / total) * 100);
  const daysLeft = dosage > 0 ? Math.floor(remaining / dosage) : remaining;
  const isLow = pct <= 15;

  return `
    <div class="detail-section detail-inventory">
      <h3 class="detail-section-title">📊 잔여량 관리</h3>
      <div class="detail-section-content">
        <div class="inventory-status">
          <div class="inventory-progress-wrap">
            <div class="inventory-progress">
              <div class="inventory-progress-fill ${isLow ? 'low' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="inventory-pct">${pct}%</div>
          </div>
          <div class="inventory-info">
            <span class="inventory-remaining">${remaining}정 / ${total}정</span>
            <span class="inventory-days">약 ${daysLeft}일 남음</span>
          </div>
        </div>
        <div class="inventory-edit">
          <div class="inventory-field">
            <label>아 수 (1통)</label>
            <input type="number" id="inv-total" value="${total}" min="1" max="999" class="inv-input">
          </div>
          <div class="inventory-field">
            <label>1회 복용량</label>
            <input type="number" id="inv-dosage" value="${dosage}" min="1" max="20" class="inv-input">
          </div>
        </div>
        <div class="inventory-actions">
          <button class="btn-inv-save" onclick="window.app.updateSupplementInventory('${p.id}', parseInt(document.getElementById('inv-total').value), parseInt(document.getElementById('inv-dosage').value)); window.app.closeDetail()">
            💾 저장
          </button>
          <button class="btn-inv-refill" onclick="window.app.refillSupplement('${p.id}'); window.app.closeDetail()">
            🔄 리필
          </button>
        </div>
      </div>
    </div>
  `;
}
