// api/ocr/analyze.js — Gemini Vision OCR + DB 매칭 Serverless Function
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: '이미지 데이터가 필요합니다' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'AI 서비스 설정이 필요합니다' });
  }

  try {
    // 1. Gemini Vision으로 이미지 분석
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              }
            },
            {
              text: `이 이미지는 건강기능식품(영양제) 제품 사진입니다.
이미지에서 다음 정보를 추출해주세요:

1. 제품명 (정확한 한글 제품명)
2. 브랜드/제조사명
3. 주요 성분 목록 (라벨에 보이는 성분)
4. DB 검색용 키워드 (제품을 찾기 위한 핵심 단어 2~4개)

반드시 아래 JSON 형식으로만 답하세요. 다른 설명은 넣지 마세요:
{
  "productName": "제품명",
  "brand": "브랜드명",
  "ingredients": ["성분1", "성분2"],
  "searchTerms": ["키워드1", "키워드2"]
}`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        }
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      throw new Error('AI 이미지 분석 실패');
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini raw response:', rawText.slice(0, 500));

    // JSON 파싱 (여러 방법 시도)
    let analysis;
    try {
      // 1차: 직접 파싱
      analysis = JSON.parse(rawText);
    } catch {
      try {
        // 2차: 마크다운 코드블록 제거 후 파싱
        const cleaned = rawText.replace(/```(?:json)?\n?/g, '').trim();
        analysis = JSON.parse(cleaned);
      } catch {
        try {
          // 3차: 중괄호 영역 추출
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            analysis = JSON.parse(match[0]);
          } else {
            throw new Error('no json');
          }
        } catch {
          console.error('Gemini JSON parse failed. Raw:', rawText);
          // 폴백: 텍스트에서 제품명 키워드 추출
          analysis = {
            productName: rawText.slice(0, 100),
            brand: '',
            ingredients: [],
            searchTerms: rawText.match(/[가-힣]{2,}/g)?.slice(0, 4) || [],
          };
        }
      }
    }

    // 2. DB에서 제품 검색
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    const searchTerms = analysis.searchTerms || [];
    // 브랜드 + 제품명 조합으로도 검색
    if (analysis.brand) searchTerms.push(analysis.brand);
    if (analysis.productName) searchTerms.push(analysis.productName);

    // 각 검색어로 DB 조회, 결과 합산
    const allMatches = [];
    const seen = new Set();

    for (const term of searchTerms) {
      if (!term) continue;
      const noSpace = term.replace(/\s+/g, '');

      // 원본 검색
      const { data: d1 } = await supabase
        .from('supplements_catalog')
        .select('*')
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
        .range(0, 9);

      // 띄어쓰기 제거 검색
      const { data: d2 } = (noSpace !== term)
        ? await supabase
            .from('supplements_catalog')
            .select('*')
            .or(`name.ilike.%${noSpace}%,brand.ilike.%${noSpace}%`)
            .range(0, 9)
        : { data: [] };

      for (const item of [...(d1 || []), ...(d2 || [])]) {
        const key = item.regist_no || item.id;
        if (!seen.has(key)) {
          seen.add(key);
          allMatches.push(item);
        }
      }
    }

    // 관련도 정렬: 제품명에 더 많은 키워드가 포함된 것 우선
    const coreTerms = (analysis.searchTerms || []).map(t => t.toLowerCase());
    allMatches.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      const scoreA = coreTerms.filter(t => nameA.includes(t)).length;
      const scoreB = coreTerms.filter(t => nameB.includes(t)).length;
      return scoreB - scoreA;
    });

    // 상위 10개만
    const topMatches = allMatches.slice(0, 10).map(item => ({
      id: `api-${item.regist_no || item.id}`,
      name: item.name,
      brand: item.brand || '',
      registNo: item.regist_no || '',
      icon: '💊',
      category: 'etc',
      source: 'api',
    }));

    res.json({
      analysis: {
        productName: analysis.productName || '',
        brand: analysis.brand || '',
        ingredients: analysis.ingredients || [],
      },
      matches: topMatches,
      searchTerms: analysis.searchTerms || [],
    });

  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: err.message || '이미지 인식 실패' });
  }
}
