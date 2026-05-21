// api/analyze/ingredients.js — Gemini 성분 과다/충돌 분석 Serverless Function
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { supplements } = req.body; // [{ name, registNo }]
  if (!supplements || supplements.length < 2) {
    return res.status(400).json({ error: '영양제 2개 이상 필요' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.json({ warnings: [], cautions: [], synergies: [], deficiencies: [], source: 'none' });
  }

  // Supabase에서 제품 상세 정보 조회
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const productDetails = [];
  for (const supp of supplements) {
    let item = null;
    if (supp.registNo) {
      const { data } = await supabase
        .from('supplements_catalog')
        .select('name, main_function, intake, caution')
        .eq('regist_no', supp.registNo)
        .single();
      item = data;
    }
    if (!item && supp.name) {
      const { data } = await supabase
        .from('supplements_catalog')
        .select('name, main_function, intake, caution')
        .ilike('name', `%${supp.name}%`)
        .limit(1)
        .single();
      item = data;
    }
    productDetails.push({
      name: item?.name || supp.name,
      mainFunction: item?.main_function || '',
      intake: item?.intake || '',
      caution: item?.caution || '',
    });
  }

  const productList = productDetails.map((p, i) =>
    `${i + 1}. ${p.name}\n   기능: ${p.mainFunction.slice(0, 500)}\n   복용법: ${p.intake.slice(0, 300)}\n   주의사항: ${p.caution.slice(0, 300)}`
  ).join('\n\n');

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `당신은 10년 차 약사이자 개인화 건강 관리 코치입니다.
사용자는 복잡한 수치보다 '지금 당장 무엇을 바꿔야 하는지'를 알고 싶어 합니다.
분석 결과는 반드시 임상적 중요도에 따라 정렬하세요.

[등록된 영양제]
${productList}

[앱 기능 제약]
- 이 앱은 매일 고정 시간 알림만 지원합니다 (격일/주간 알림 불가)
- 따라서 "격일 복용", "주 3회" 같은 권고는 하지 마세요
- 과다 섭취 위험 시, 아래 우선순위로 권고하세요:
  1순위: 중복 성분이 적은 쪽 제품의 제거/교체 제안
  2순위: 합산 수치와 상한치 비교 후 "허용 범위 내" 판정
  3순위: 의사/약사 상담 권고

[분석 규칙]
1. Triage(분류): 모든 항목을 중요도로 분류
   - critical: 즉시 조정 필요 (과다복용 위험, 위험한 상호작용)
   - caution: 복용법 조정 권장 (흡수 방해, 타이밍 변경 필요)
   - info: 참고 정보 (시너지 효과, 좋은 조합)

2. Routine Design: 성분 충돌을 피하는 최적 복용 시간표
   아침(식후), 저녁(식후), 취침 전 중에서 배치하고 이유를 설명

3. 핵심 6대 영양소 커버리지 체크
   비타민D(800IU), 오메가3(500mg), 마그네슘(350mg), 비타민B12(2.4μg), 유산균(1억CFU), 비타민C(100mg)
   반드시 6개 모두 deficiencies 배열에 포함. 등록 제품에 없으면 status를 "missing", 있으면 "sufficient" 또는 "partial"로.

4. Human-Centric Summary: 비전문가도 이해할 수 있는 headline과 keyAction 생성
5. healthScore: 0~100점. 위험 요소가 없으면 85~95, critical이 있으면 60 이하.
6. 확실한 근거가 있는 것만 포함하세요. 불확실하면 제외.

JSON만 응답하세요:
{
  "summary": {
    "headline": "한줄 핵심 결론",
    "keyAction": "지금 당장 해야 할 행동",
    "healthScore": 75
  },
  "optimizedRoutine": [
    { "time": "아침 (식후)", "products": ["제품명"], "note": "이유" }
  ],
  "technicalAnalysis": [
    {
      "level": "critical|caution|info",
      "title": "한줄 제목",
      "detail": "구체적 설명",
      "action": "사용자가 취해야 할 행동",
      "products": ["관련 제품"],
      "nutrients": ["관련 성분"]
    }
  ],
  "deficiencies": [
    { "nutrient": "영양소명", "dailyRecommended": "권장량", "status": "sufficient|partial|missing", "coveringProducts": ["제품명"], "recommendation": "부족 시 추천" }
  ],
  "extractedNutrients": [
    { "product": "제품명", "nutrients": ["성분1", "성분2"] }
  ]
}`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 512 },
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API 오류 (${geminiRes.status}): ${errText.substring(0, 200)}`);
    }

    const geminiData = await geminiRes.json();
    const allParts = geminiData.candidates?.[0]?.content?.parts || [];
    let rawText = '';
    for (const part of allParts) {
      if (part.text) rawText += part.text + '\n';
    }

    const stripped = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    let result = { summary: { headline: '', keyAction: '', healthScore: 50 }, optimizedRoutine: [], technicalAnalysis: [], deficiencies: [], extractedNutrients: [] };

    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn('성분 분석 JSON 파싱 실패:', e.message);
      }
    }

    res.json({ ...result, source: 'gemini' });
  } catch (err) {
    console.error('성분 분석 오류:', err.message);
    res.json({ summary: { headline: '', keyAction: '', healthScore: 50 }, optimizedRoutine: [], technicalAnalysis: [], deficiencies: [], extractedNutrients: [], source: 'error', message: err.message });
  }
}
