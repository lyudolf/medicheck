// Home Component - 메인 화면 (v2 리디자인)

import { state, addSupplement, removeSupplement } from '../main.js';
import { getTodaySchedule } from '../services/reminder.js';
import { getSupplementIcon } from '../utils/icons.js';

export function renderHome() {
  const supplements = state.supplements;
  const isEmpty = supplements.length === 0;

  return `
    <div class="page active ${supplements.length >= 2 ? 'has-fab' : ''}" id="page-home">
      ${_renderHeader()}
      <div class="page-content">
        ${isEmpty ? _renderEmpty() : _renderMainContent(supplements)}
      </div>
    </div>
  `;
}

export function renderHomeFAB() {
  const count = state.supplements.length;
  if (count < 2) return '';
  return _renderAnalyzeFAB(count);
}

function _renderHeader() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekdays = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  const weekday = weekdays[now.getDay()];
  const hour = now.getHours();
  let greeting = '안녕하세요,';
  if (hour < 12) greeting = '좋은 아침이에요,';
  else if (hour < 18) greeting = '안녕하세요,';
  else greeting = '오늘 하루도 수고하셨어요,';

  return `
    <div class="home-header">
      <div class="home-greeting">
        <h2 class="home-date"><span class="greeting-highlight">${month}월 ${day}일 ${weekday}</span></h2>
        <h1>${greeting}<br><span class="greeting-highlight">오늘도 건강한 하루</span> 되세요!</h1>
      </div>
    </div>
  `;
}

function _renderEmpty() {
  return `
    <div class="empty-state-v2 animate-in">
      <div class="empty-pill-art">
        <div class="pill-circle">
          <img src="/icons/logo.svg" alt="" class="pill-icon-main" style="width:48px;height:48px;" />
          <span class="pill-icon-sub">📄</span>
          <span class="pill-plus">+</span>
        </div>
      </div>
      <h2>등록된 영양제가 아직 없어요</h2>
      <p>복용 중인 영양제를 등록하고<br>안전한 복용 스케줄을 추천받아보세요.</p>
      <div class="empty-actions">
        <button class="btn-cta-primary" onclick="window.app.navigate('search')">
          <span>🔍</span> 영양제 검색해서 등록하기
        </button>
        <button class="btn-cta-secondary" onclick="window.app.navigate('camera')">
          <span>🧠</span> AI로 라벨 인식하기
        </button>
      </div>
    </div>
  `;
}

function _renderMainContent(supplements) {
  return `
    ${_renderRepurchaseBanner(supplements)}
    ${_renderTodaySchedule()}
    ${_renderShelf(supplements)}
  `;
}

function _renderTodaySchedule() {
  const schedule = getTodaySchedule(state.timingResult);
  if (schedule.length === 0) return '';

  const today = new Date().toISOString().slice(0, 10);
  let checkedItems = [];
  try {
    const saved = localStorage.getItem('medicheck_checked_' + today);
    if (saved) checkedItems = JSON.parse(saved);
  } catch (e) { /* ignore */ }

  return `
    <div class="section-title animate-in animate-in-delay-1">
      <span class="section-icon">⏰</span>
      오늘의 복용 스케줄
    </div>
    <div class="schedule-card animate-in animate-in-delay-1" style="margin-bottom:20px;">
      ${schedule.map(slot => `
        <div class="schedule-slot-header">
          <span class="schedule-slot-time">${slot.time}</span>
          <span class="schedule-slot-meta">${slot.emoji} ${slot.label} · ${slot.desc}</span>
        </div>
        ${slot.supplements.map(s => {
          const isDone = checkedItems.includes(s.id || s.name);
          return `
            <div class="schedule-item ${isDone ? 'done' : ''}">
              <div class="schedule-item-info">
                <span class="schedule-item-icon">${getSupplementIcon(s.icon)}</span>
                <span class="schedule-item-name">${s.name}</span>
              </div>
              <button class="dose-check-btn ${isDone ? 'checked' : ''}"
                      onclick="window.app.toggleDoseCheck('${s.id || s.name}')">
                ${isDone ? 'Stack!' : '먹었어요'}
              </button>
            </div>
          `;
        }).join('')}
      `).join('')}
    </div>
  `;
}

function _renderShelf(supplements) {
  return `
    <div class="section-title animate-in animate-in-delay-2">
      <span class="section-icon">📦</span>
      내 영양제 선반 (${supplements.length}개)
    </div>
    <div class="supplement-grid">
      ${supplements.map((s, i) => {
        const total = s.totalPills || 60;
        const remaining = s.remainingPills ?? total;
        const pct = Math.round((remaining / total) * 100);
        const isLow = pct <= 15;
        const daysLeft = (s.dosagePerTake || 1) > 0 ? Math.floor(remaining / (s.dosagePerTake || 1)) : remaining;
        return `
        <div class="supplement-card animate-in animate-in-delay-${(i % 4) + 1}" data-id="${s.id}"
             onclick="window.app.showShelfDetail('${s.id}')" style="cursor:pointer;">
          <button class="remove-btn" onclick="event.stopPropagation(); window.app.removeSupplement('${s.id}')" title="삭제">✕</button>
          ${isLow ? '<span class="inventory-badge">⚠️ 곧 소진</span>' : ''}
          <div class="icon">${getSupplementIcon(s.icon)}</div>
          <div class="name">${s.name}</div>
          <div class="brand">${s.brand}</div>
          <div class="inventory-bar-wrap">
            <div class="inventory-bar">
              <div class="inventory-bar-fill ${isLow ? 'low' : ''}" style="width:${pct}%"></div>
            </div>
            <span class="inventory-label">${remaining}정 / ${total}정 <span class="inventory-edit-hint">⚙️</span></span>
          </div>
        </div>
      `;
      }).join('')}
      <div class="add-card animate-in" onclick="window.app.navigate('search')">
        <div class="add-icon">+</div>
        <span>영양제 추가</span>
      </div>
    </div>
  `;
}

function _renderAnalyzeFAB(count) {
  return `
    <button class="analyze-fab" onclick="window.app.startAnalysis()">
      🔬 성분 분석하기
      <span class="fab-badge">${count}개 영양제</span>
    </button>
  `;
}

function _renderRepurchaseBanner(supplements) {
  const lowSupps = supplements.filter(s => {
    const total = s.totalPills || 60;
    const remaining = s.remainingPills ?? total;
    const pct = (remaining / total) * 100;
    return pct <= 15;
  });

  if (lowSupps.length === 0) return '';

  return `
    <div class="repurchase-banner animate-in">
      <div class="repurchase-banner-icon">🛒</div>
      <div class="repurchase-banner-content">
        <div class="repurchase-banner-title">재구매가 필요해요!</div>
        <div class="repurchase-banner-list">
          ${lowSupps.map(s => {
            const remaining = s.remainingPills ?? 0;
            const daysLeft = Math.floor(remaining / (s.dosagePerTake || 1));
            return `
              <a class="repurchase-item" href="${_getCoupangUrl(s.name)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                <span>${s.name} (약 ${daysLeft}일 남음)</span>
                <span class="repurchase-cta">재구매 ›</span>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    </div>
    <div class="repurchase-disclaimer">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.</div>
  `;
}

function _getCoupangUrl(productName) {
  return `https://link.coupang.com/re/AFFTAG?lptag=AF7110745&subId=pillstack&pageType=SRP&q=${encodeURIComponent(productName)}`;
}
