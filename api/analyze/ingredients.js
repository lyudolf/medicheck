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
            text: `당신은 영양학·약학 전문가입니다. 아래 영양제를 동시 복용할 때의 성분 과다/충돌/시너지를 분석하고, 핵심 영양소 부족 여부도 판단하세요.

[등록된 영양제]
${productList}

분석 규칙:
1. 각 제품의 "기능" 필드에서 핵심 영양 성분을 추출하세요.
2. 동일 성분이 여러 제품에 포함되어 일일 상한섭취량(UL)을 초과할 위험이 있으면 warnings에 추가하세요.
3. 동시 섭취 시 흡수를 방해하는 조합(예: 칼슘↔철분, 아연↔구리)은 cautions에 추가하세요.
4. 서로 흡수를 촉진하는 좋은 조합은 synergies에 추가하세요.
5. 확실한 근거가 있는 것만 포함하세요. 불확실하면 제외하세요.
6. 아래 핵심 6대 영양소가 등록된 영양제에 포함되어 있는지 판단하세요:
   - 비타민D (800IU), 오메가3/EPA+DHA (500mg), 마그네슘 (350mg), 비타민B군/B12 (2.4μg), 유산균 (1억CFU), 비타민C (100mg)
   반드시 6개 모두 deficiencies 배열에 포함하세요. 등록 제품에 해당 성분이 없으면 status를 "missing"으로, 있으면 "sufficient" 또는 "partial"로 설정하세요.
   missing인 경우 recommendation에 해당 영양소를 보충할 수 있는 식품이나 보충제를 추천하세요.

JSON만 응답하세요:
{
  "extractedNutrients": [
    { "product": "제품명", "nutrients": ["성분1", "성분2"] }
  ],
  "warnings": [
    { "nutrient": "성분명", "products": ["제품A", "제품B"], "reason": "이유", "severity": "high" }
  ],
  "cautions": [
    { "nutrients": ["성분A", "성분B"], "products": ["제품A", "제품B"], "reason": "이유", "severity": "medium" }
  ],
  "synergies": [
    { "nutrients": ["성분A", "성분B"], "products": ["제품A", "제품B"], "reason": "이유" }
  ],
  "deficiencies": [
    { "nutrient": "영양소명", "dailyRecommended": "권장량", "status": "sufficient|partial|missing", "coveringProducts": ["해당 제품명"], "recommendation": "부족 시 추천 내용" }
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
    let result = { extractedNutrients: [], warnings: [], cautions: [], synergies: [], deficiencies: [] };

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
    res.json({ warnings: [], cautions: [], synergies: [], deficiencies: [], source: 'error', message: err.message });
  }
}
