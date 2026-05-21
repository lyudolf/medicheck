// ═══════════════════════════════════════════
// Analysis Engine
// Interaction checking + timing recommendation
// ═══════════════════════════════════════════

import { INGREDIENTS, INTERACTIONS } from '../data/fallbackDB.js';
import { publicDataAPI } from '../api/publicData.js';
import { apiUrl } from '../utils/api.js';

/**
 * 등록된 영양제들의 성분 간 상호작용 분석
 * @param {Array} supplements - 사용자가 등록한 영양제 목록
 * @returns {Object} { score, interactions, summary }
 */
export async function analyzeInteractions(supplements) {
  if (!supplements || supplements.length < 2) {
    return { score: 100, interactions: [], summary: '영양제를 2개 이상 등록해주세요.' };
  }

  // 1. 모든 성분 추출 (중복 제거 + 어떤 영양제에서 왔는지 추적)
  const ingredientMap = new Map(); // ingredientId -> [supplement names]
  for (const supp of supplements) {
    for (const ingId of (supp.ingredients || [])) {
      if (!ingredientMap.has(ingId)) ingredientMap.set(ingId, []);
      ingredientMap.get(ingId).push(supp.name);
    }
  }

  const allIngredientIds = [...ingredientMap.keys()];
  const results = [];

  // 2. 로컬 DB 상호작용 체크
  for (const rule of INTERACTIONS) {
    const hasA = allIngredientIds.includes(rule.ingredientA);
    const hasB = allIngredientIds.includes(rule.ingredientB);

    if (hasA && hasB) {
      const sourcesA = ingredientMap.get(rule.ingredientA);
      const sourcesB = ingredientMap.get(rule.ingredientB);

      results.push({
        ...rule,
        sourceA: sourcesA.join(', '),
        sourceB: sourcesB.join(', '),
        ingredientAName: INGREDIENTS[rule.ingredientA]?.nameKr || rule.ingredientA,
        ingredientBName: INGREDIENTS[rule.ingredientB]?.nameKr || rule.ingredientB,
      });
    }
  }

  // 3. API DUR 체크 (API 키가 있는 경우)
  //    사용자 영양제 성분 간 실제 충돌만 필터링
  //    (의약품과의 병용금기는 제외 — 이트라코나졸 등 수백건 방지)
  if (publicDataAPI.isConfigured) {
    try {
      // 사용자 영양제에 포함된 한글 성분명 목록
      const userIngredientNames = new Set();
      for (const ingId of allIngredientIds) {
        const ingData = INGREDIENTS[ingId];
        if (ingData?.nameKr) userIngredientNames.add(ingData.nameKr);
      }

      const checkedPairs = new Set(); // 중복 방지용

      for (const ingId of allIngredientIds) {
        const ingData = INGREDIENTS[ingId];
        if (!ingData) continue;

        const durResults = await publicDataAPI.checkDURInteractions(ingData.nameKr);
        if (!durResults || durResults.length === 0) continue;

        for (const dur of durResults) {
          // 핵심: 상대 성분(ingredientB)이 사용자 영양제에 있는 경우만 표시
          const otherIngredient = dur.ingredientB || '';
          const isRelevant = [...userIngredientNames].some(
            (name) => otherIngredient.includes(name) || name.includes(otherIngredient)
          );

          if (!isRelevant || !dur.prohibition) continue;

          // 중복 체크 (A-B, B-A 동일 취급)
          const pairKey = [ingData.nameKr, otherIngredient].sort().join('↔');
          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);

          // 로컬 DB에서 이미 잡은 것도 제외
          const alreadyExists = results.some(
            (r) => r.ingredientAName === ingData.nameKr && r.ingredientBName === otherIngredient
              || r.ingredientAName === otherIngredient && r.ingredientBName === ingData.nameKr
          );
          if (alreadyExists) continue;

          results.push({
            type: 'conflict',
            severity: 'warning',
            ingredientA: ingId,
            ingredientB: 'dur-api',
            ingredientAName: dur.ingredientA || ingData.nameKr,
            ingredientBName: otherIngredient,
            title: `⚠️ DUR 주의: ${dur.ingredientA || ingData.nameKr}`,
            description: dur.prohibition,
            tip: '의약품안전사용서비스(DUR) 정보입니다. 자세한 사항은 약사에게 문의하세요.',
            sourceA: ingredientMap.get(ingId)?.join(', ') || '',
            sourceB: 'DUR DB',
            fromAPI: true,
          });
        }
      }
    } catch (err) {
      console.warn('DUR API 분석 실패, 로컬 DB 결과만 표시:', err);
    }
  }

  // 4. Gemini 성분 과다/충돌 분석 (서버 API 호출)
  let ingredientAnalysis = { summary: { headline: '', keyAction: '', healthScore: 50 }, optimizedRoutine: [], technicalAnalysis: [], deficiencies: [], extractedNutrients: [] };
  let geminiDebugInfo = '';
  try {
    const fetchUrl = apiUrl('/api/analyze/ingredients');
    const bodyData = {
      supplements: supplements.map(s => ({
        name: s.name,
        registNo: s.registNo || s.id?.replace('api-', ''),
      })),
    };
    console.log('[Gemini] Calling:', fetchUrl, JSON.stringify(bodyData));
    
    const geminiRes = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
    });
    
    console.log('[Gemini] Status:', geminiRes.status);
    
    if (geminiRes.ok) {
      const data = await geminiRes.json();
      console.log('[Gemini] Source:', data.source, 'Keys:', Object.keys(data));
      if (data.source !== 'none' && data.source !== 'error') {
        ingredientAnalysis = data;
      } else {
        geminiDebugInfo = `API returned source="${data.source}" msg="${data.message || ''}"`;
      }
    } else {
      const errText = await geminiRes.text().catch(() => '');
      geminiDebugInfo = `HTTP ${geminiRes.status}: ${errText.slice(0, 200)}`;
    }
  } catch (err) {
    console.warn('Gemini 성분 분석 실패, 로컬 결과만 표시:', err);
    geminiDebugInfo = `Fetch Error: ${err.message}`;
  }
  
  // 디버그: Gemini 실패 시 headline에 에러 정보 표시 (임시)
  if (geminiDebugInfo && !ingredientAnalysis.summary?.headline) {
    ingredientAnalysis.summary = { 
      ...ingredientAnalysis.summary, 
      headline: `⚠️ AI 분석 실패: ${geminiDebugInfo}` 
    };
  }

  // 5. 점수 계산: Gemini healthScore 우선, 없으면 로컬 계산
  let score = ingredientAnalysis.summary?.healthScore || 50;
  if (!ingredientAnalysis.summary?.healthScore) {
    score = 100;
    for (const r of results) {
      if (r.type === 'conflict' && r.severity === 'warning') score -= 15;
      else if (r.type === 'conflict' && r.severity === 'caution') score -= 8;
      else if (r.type === 'synergy') score += 3;
    }
    score = Math.max(0, Math.min(100, score));
  }

  // 6. 시너지/충돌 분리 정렬
  const synergies = results.filter((r) => r.type === 'synergy');
  const conflicts = results.filter((r) => r.type === 'conflict');
  const techAnalysis = ingredientAnalysis.technicalAnalysis || [];
  const critCount = techAnalysis.filter(t => t.level === 'critical').length;
  const cautCount = techAnalysis.filter(t => t.level === 'caution').length;
  const infoCount = techAnalysis.filter(t => t.level === 'info').length;

  return {
    score,
    interactions: [...conflicts, ...synergies],
    conflictCount: conflicts.length + critCount + cautCount,
    synergyCount: synergies.length + infoCount,
    ingredientAnalysis,
    summary: ingredientAnalysis.summary?.headline || _generateSummary(score, conflicts.length + critCount + cautCount, synergies.length + infoCount),
  };
}

/**
 * 최적 복용 스케줄 생성
 * @param {Array} supplements - 사용자가 등록한 영양제 목록
 * @returns {Object} { morning, evening, schedule }
 */
export function getTimingRecommendation(supplements) {
  if (!supplements || supplements.length === 0) {
    return { morning: [], evening: [], notes: [] };
  }

  const morning = [];
  const evening = [];
  const bedtime = [];
  const notes = [];

  // 각 영양제의 주요 성분 기반으로 복용 시간 결정
  for (const supp of supplements) {
    let morningScore = 0;
    let eveningScore = 0;
    let withFood = false;

    for (const ingId of (supp.ingredients || [])) {
      const ingData = INGREDIENTS[ingId];
      if (!ingData) continue;

      if (ingData.timing === 'morning') morningScore++;
      else if (ingData.timing === 'evening') eveningScore++;

      if (ingData.withFood) withFood = true;
    }

    const entry = {
      ...supp,
      withFood,
    };

    if (eveningScore > morningScore) {
      evening.push(entry);
    } else {
      morning.push(entry);
    }
  }

  // 충돌 성분 분리 처리
  // 칼슘 + 철분 처리: 철분을 아침으로, 칼슘을 저녁으로
  const morningIng = new Set();
  const eveningIng = new Set();

  morning.forEach((s) => s.ingredients?.forEach((i) => morningIng.add(i)));
  evening.forEach((s) => s.ingredients?.forEach((i) => eveningIng.add(i)));

  // 아침에 칼슘과 철분이 함께 있으면 칼슘 쪽 영양제를 저녁으로 이동
  if (morningIng.has('calcium') && morningIng.has('iron')) {
    const calciumSupps = morning.filter((s) => s.ingredients?.includes('calcium') && !s.ingredients?.includes('iron'));
    for (const s of calciumSupps) {
      const idx = morning.indexOf(s);
      if (idx !== -1) {
        morning.splice(idx, 1);
        evening.push(s);
        notes.push(`💡 ${s.name}을(를) 저녁으로 이동했습니다 (철분과의 흡수 방해 방지).`);
      }
    }
  }

  // 콜라겐은 취침 전 공복 권장
  const collagenInEvening = evening.filter((s) => s.ingredients?.includes('collagen'));
  if (collagenInEvening.length > 0) {
    for (const s of collagenInEvening) {
      bedtime.push(s);
      evening.splice(evening.indexOf(s), 1);
    }
    notes.push('💡 콜라겐은 취침 전 공복에 복용하면 흡수율이 높아집니다.');
  }

  // 유산균 공복 권장 노트
  const hasProbiotics = supplements.some((s) => s.ingredients?.includes('probiotics'));
  if (hasProbiotics) {
    notes.push('💡 유산균은 아침 공복 또는 식전에 복용하는 것이 좋습니다.');
  }

  // 마그네슘 저녁 노트
  if (eveningIng.has('magnesium') || morningIng.has('magnesium')) {
    notes.push('💡 마그네슘은 근육 이완 효과가 있어 저녁 복용이 숙면에 도움됩니다.');
  }

  return {
    morning,
    evening,
    bedtime,
    notes,
    schedule: [
      { time: '🌅 아침 (식사 후)', supplements: morning, label: '아침' },
      { time: '🌙 저녁 (식사 후)', supplements: evening, label: '저녁' },
      ...(bedtime.length > 0 ? [{ time: '😴 취침 전', supplements: bedtime, label: '취침 전' }] : []),
    ],
  };
}

function _generateSummary(score, conflictCount, synergyCount) {
  if (score >= 90) {
    return `전반적으로 안전합니다! 시너지 효과 ${synergyCount}건이 있습니다.`;
  } else if (score >= 70) {
    return `주의가 필요한 조합 ${conflictCount}건이 있습니다. 복용 시간을 조절해주세요.`;
  } else {
    return `⚠️ 충돌 ${conflictCount}건 발견! 복용 전 약사와 상담을 권장합니다.`;
  }
}
