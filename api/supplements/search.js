// api/supplements/search.js — Vercel Serverless Function
import { createClient } from '@supabase/supabase-js';

// 카테고리 분류 규칙 (server.js와 동일)
const CATEGORY_RULES = [
  { id: 'vitamin',   icon: '🍊', keywords: ['비타민c','비타민 c','vitamin c','비타민d','비타민 d','비타민b','비타민 b','b군','비타민a','비타민e','비타민 e','베타카로틴','멀티비타민','종합비타민','multivitamin'] },
  { id: 'probiotic', icon: '🦠', keywords: ['유산균','프로바이오틱','probiot','혼합유산균','락토바실러스','식이섬유','프리바이오틱','fiber'] },
  { id: 'herbal',    icon: '🌿', keywords: ['홍삼','인삼','ginseng','진세노사이드','밀크씨슬','실리마린','milk thistle','프로폴리스','propolis'] },
  { id: 'mineral',   icon: '⚡', keywords: ['아연','zinc','철분','iron','헴철','칼슘','calcium','마그네슘','magnesium','셀레늄','selenium'] },
  { id: 'omega',     icon: '🐟', keywords: ['오메가3','오메가 3','omega-3','omega3','epa','dha','크릴','krill','감마리놀렌','달맞이꽃','gla'] },
  { id: 'function',  icon: '🦴', keywords: ['루테인','lutein','지아잔틴','콜라겐','collagen','msm','글루코사민','glucosamine','콘드로이틴','코엔자임','coq10','크레아틴','프로틴','단백질'] },
];

function classifyProduct(name) {
  const n = (name || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => n.includes(kw))) {
      return { category: rule.id, icon: rule.icon };
    }
  }
  return { category: 'etc', icon: '💊' };
}

function parseIngredients(name) {
  const map = {
    '비타민C': 'vitamin-c', '비타민D': 'vitamin-d', '비타민E': 'vitamin-e',
    '비타민B': 'vitamin-b', '엽산': 'folic-acid', '비오틴': 'biotin',
    '칼슘': 'calcium', '마그네슘': 'magnesium', '철분': 'iron', '아연': 'zinc',
    '셀레늄': 'selenium', 'EPA': 'omega3-epa', 'DHA': 'omega3-dha',
    '유산균': 'probiotics', '콜라겐': 'collagen', '루테인': 'lutein',
    '밀크씨슬': 'silymarin', '홍삼': 'red-ginseng', '글루코사민': 'glucosamine',
  };
  const found = [];
  for (const [kw, id] of Object.entries(map)) {
    if (name.includes(kw) && !found.includes(id)) found.push(id);
  }
  return found;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { keyword, page = 1, size = 20, category } = req.query;
  const pageNum  = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(size)));
  const from = (pageNum - 1) * pageSize;
  const to   = from + pageSize - 1;

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );

    const mapItem = (item) => {
      const { category: cat, icon } = classifyProduct(item.name);
      return {
        id: `api-${item.regist_no || item.id}`,
        name: item.name,
        brand: item.brand || '',
        registNo: item.regist_no || '',
        registDate: item.regist_date || '',
        description: '',
        rawMaterials: '',
        ingredients: parseIngredients(item.name),
        source: 'api',
        icon,
        category: cat,
        mainFunction: item.main_function || '',
        intake: item.intake || '',
        caution: item.caution || '',
      };
    };

    let allItems = [];
    let totalCount = 0;

    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      const words = kw.split(/\s+/).filter(Boolean);
      const noSpace = kw.replace(/\s+/g, '');

      // 쿼리 1: 각 단어 AND 검색 (name/brand 모두)
      let q1 = supabase.from('supplements_catalog').select('*', { count: 'exact' });
      for (const word of words) {
        q1 = q1.or(`name.ilike.%${word}%,brand.ilike.%${word}%`);
      }
      q1 = q1.range(0, 499); // 충분한 범위
      const r1 = await q1;
      if (!r1.error) allItems.push(...(r1.data || []));

      // 쿼리 2: 붙여쓰기 검색 (다중 단어일 때만, 중복 방지)
      if (words.length > 1 && noSpace !== words[0]) {
        let q2 = supabase.from('supplements_catalog').select('*')
          .or(`name.ilike.%${noSpace}%,brand.ilike.%${noSpace}%`)
          .range(0, 499);
        const r2 = await q2;
        if (!r2.error) allItems.push(...(r2.data || []));
      }

      // 중복 제거 (regist_no 기준)
      const seen = new Set();
      allItems = allItems.filter(item => {
        const key = item.regist_no || item.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      totalCount = allItems.length;
    } else {
      // 키워드 없을 때: 전체 목록
      let q = supabase.from('supplements_catalog').select('*', { count: 'exact' });
      if (category && category !== 'all') {
        q = q.range(0, 9999);
      } else {
        q = q.range(from, to);
      }
      const { data, error, count } = await q;
      if (error) throw error;
      allItems = data || [];
      totalCount = count || 0;
    }

    let mapped = allItems.map(mapItem);

    // 카테고리 후처리 필터
    if (category && category !== 'all') {
      mapped = mapped.filter(item => item.category === category);
      totalCount = mapped.length;
    }

    // 키워드 검색 시에는 전체를 가져왔으므로 페이징 처리
    const paged = (keyword && keyword.trim())
      ? mapped.slice(from, from + pageSize)
      : (category && category !== 'all' ? mapped.slice(from, from + pageSize) : mapped);
    const total = totalCount;

    res.json({
      items: paged,
      source: 'supabase',
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize),
      hasMore: from + pageSize < total,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message, items: [], total: 0 });
  }
}
