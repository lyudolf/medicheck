// ═══════════════════════════════════════════
// Search Component - 영양제 검색 & 추가
// 무한 스크롤 + 정적 DB 기반
// ═══════════════════════════════════════════

import { CATEGORIES } from '../data/fallbackDB.js';
import { getSupplementIcon } from '../utils/icons.js';
import { apiUrl } from '../utils/api.js';

let searchTimeout = null;
let currentCategory = 'all';

// 무한 스크롤 상태
let currentQuery = '';
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let displayedItems = [];       // 현재 화면에 표시된 전체 아이템
let scrollObserver = null;

// 검색 모드별 페이지 사이즈
const SEARCH_PAGE_SIZE = 10;   // 검색 시 10개씩
const BROWSE_PAGE_SIZE = 30;   // 전체 목록 시 30개씩

export function renderSearch() {
  // 상태 초기화
  currentQuery = '';
  currentPage = 1;
  isLoading = false;
  hasMore = true;
  displayedItems = [];

  return `
    <div class="page active" id="page-search">
      <div class="page-header">
        <h1 style="display:flex;align-items:center;gap:10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="22" y1="22" x2="16.65" y2="16.65"/>
          </svg>
          영양제 검색
        </h1>
        <p class="subtitle">44,000개 이상의 건강기능식품 데이터베이스</p>
      </div>
      <div class="page-content">
        <div class="search-container">
          <span class="search-icon" style="display:flex;align-items:center;justify-content:center;color:#6366f1;">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="22" y1="22" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            class="search-input"
            id="search-input"
            placeholder="영양제 이름 또는 브랜드 검색..."
            autocomplete="off"
            oninput="window.app.handleSearch(this.value)"
          />
          <button class="search-clear" id="search-clear"
                  onclick="window.app.clearSearch()"
                  style="display:none;">✕</button>
        </div>
        <div class="category-filters" id="category-filters">
          ${Object.entries(CATEGORIES).map(([key, cat]) => `
            <button class="category-pill ${key === currentCategory ? 'active' : ''}"
              data-category="${key}"
              onclick="window.app.filterCategory('${key}')">
              ${cat.icon} ${cat.label}
            </button>
          `).join('')}
        </div>
        <div id="search-results" class="search-results">
          <div class="search-loading-init">
            <div class="spinner"></div>
            <span>전체 영양제 목록을 불러오는 중...</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 검색 모달이 열리면 자동으로 첫 목록 로드
export function initSearch() {
  setTimeout(() => {
    _loadItems('', 1, true);

    // 카테고리 필터 마우스 drag-to-scroll
    const filters = document.getElementById('category-filters');
    if (filters) {
      let isDown = false, startX = 0, scrollLeft = 0;
      filters.addEventListener('mousedown', (e) => {
        isDown = true;
        filters.style.cursor = 'grabbing';
        startX = e.pageX - filters.offsetLeft;
        scrollLeft = filters.scrollLeft;
      });
      filters.addEventListener('mouseleave', () => { isDown = false; filters.style.cursor = 'grab'; });
      filters.addEventListener('mouseup', () => { isDown = false; filters.style.cursor = 'grab'; });
      filters.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - filters.offsetLeft;
        filters.scrollLeft = scrollLeft - (x - startX);
      });
      filters.style.cursor = 'grab';
    }
  }, 100);
}

export function handleSearch(query) {
  clearTimeout(searchTimeout);

  // X 버튼 표시/숨김
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';

  searchTimeout = setTimeout(() => {
    currentQuery = query;
    currentPage = 1;
    hasMore = true;
    displayedItems = [];
    _loadItems(query, 1, true);
  }, 300);
}

export function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  currentQuery = '';
  currentPage = 1;
  hasMore = true;
  displayedItems = [];
  _loadItems('', 1, true);
}

export function filterCategory(category) {
  currentCategory = category;
  // data-category 속성으로 정확한 매칭
  document.querySelectorAll('.category-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.category === category);
  });
  currentPage = 1;
  hasMore = true;
  displayedItems = [];
  _loadItems(currentQuery, 1, true);
}

// ─── 서버에서 아이템 로드 ───
async function _loadItems(query, page, replace = false) {
  if (isLoading) return;
  isLoading = true;

  const container = document.getElementById('search-results');
  if (!container) { isLoading = false; return; }

  // 로딩 인디케이터
  if (replace) {
    container.innerHTML = `
      <div class="search-loading-init">
        <div class="spinner"></div>
        <span>${query ? `"${query}" 검색 중...` : '전체 영양제 목록을 불러오는 중...'}</span>
      </div>
    `;
  } else {
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) sentinel.innerHTML = '<div class="spinner" style="margin:8px auto;"></div>';
  }

  const pageSize = query ? SEARCH_PAGE_SIZE : BROWSE_PAGE_SIZE;

  try {
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
    if (query) params.set('keyword', query);
    if (currentCategory !== 'all') params.set('category', currentCategory);

    const res = await fetch(apiUrl(`/api/supplements/search?${params}`));
    const data = await res.json();

    if (replace) {
      displayedItems = data.items || [];
    } else {
      displayedItems = [...displayedItems, ...(data.items || [])];
    }

    hasMore = data.hasMore === true;
    currentPage = page;

    container.innerHTML = _renderResults(data.total);
    _setupScrollObserver();
  } catch (err) {
    console.warn('검색 오류:', err);
    if (replace) {
      container.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">⚠️</div>
          <p>데이터를 불러오지 못했습니다.</p>
        </div>
      `;
    }
  } finally {
    isLoading = false;
  }
}

// ─── 무한 스크롤 감지 ───
function _setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel || !hasMore) return;

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoading) {
      _loadItems(currentQuery, currentPage + 1, false);
    }
  }, {
    root: null,
    threshold: 0.1,
  });

  scrollObserver.observe(sentinel);
}

// ─── 렌더링 ───
function _renderResults(total) {
  let results = [...displayedItems];
  const addedIds = new Set((window.app?.getState()?.supplements || []).map((s) => s.id));

  if (results.length === 0 && !isLoading) {
    const catLabel = CATEGORIES[currentCategory]?.label || '';
    const filterDesc = currentCategory !== 'all' ? ` [${catLabel}]` : '';
    return `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <p>${currentQuery
          ? `"${currentQuery}"${filterDesc}에 대한 검색 결과가 없습니다.`
          : `${filterDesc || '이 카테고리에'} 해당하는 영양제가 없습니다.`}</p>
      </div>
    `;
  }

  // 상태 바: 건수 + 활성 필터 표시
  const catLabel = currentCategory !== 'all' ? CATEGORIES[currentCategory]?.label : '';
  let metaText = '';
  if (total) {
    metaText = total.toLocaleString() + '개 제품';
    if (currentQuery) metaText += ` · "${currentQuery}"`;
    if (catLabel) metaText += ` · ${catLabel}`;
  }
  const metaHtml = metaText ? `<div class="search-meta">${metaText}</div>` : '';

  const itemsHtml = results.map((s) => {
    const isAdded = addedIds.has(s.id);
    const categoryInfo = CATEGORIES[s.category] || { icon: '💊', label: '건강기능식품' };
    const isFromAPI = s.source === 'api';

    return `
      <div class="search-result-item ${isAdded ? 'added' : ''}"
           onclick="window.app.showDetail('${s.id}')">
        <div class="result-icon">${getSupplementIcon(s.icon)}</div>
        <div class="result-info">
          <div class="result-name">${s.name} ${isAdded ? '<span class="added-badge">Stack!</span>' : ''}</div>
          <div class="result-brand">${s.brand}</div>
          <div class="result-tags">
            <span class="tag tag-${s.category}">${categoryInfo.icon} ${categoryInfo.label}</span>
            ${s.ingredients?.length ? `<span class="tag">성분 ${s.ingredients.length}종</span>` : ''}
          </div>
        </div>
        <div class="result-arrow">›</div>
      </div>
    `;
  }).join('');

  // 스크롤 감지용 sentinel
  const sentinelHtml = hasMore
    ? `<div id="scroll-sentinel" class="scroll-sentinel">
         <div class="spinner" style="margin:12px auto;"></div>
       </div>`
    : `<div class="search-end">모든 결과를 표시했습니다</div>`;

  return metaHtml + itemsHtml + sentinelHtml;
}

export function getSupplementById(id) {
  return displayedItems.find((s) => s.id === id) || null;
}
