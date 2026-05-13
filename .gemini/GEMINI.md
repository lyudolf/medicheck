# PillStack Project Rules

## 1. Project Context & Domain Strictness
- **Domain:** 이 프로젝트는 오직 '영양제 성분 분석' 및 '개인 맞춤형 복용 관리'에만 철저히 집중하는 헬스케어 웹앱 'PillStack(필스택)'이다.
- **Core Scope:** 모든 비즈니스 로직, 컴포넌트 설계, 변수명 작성은 영양제 도메인(Supplement, Ingredient, Dosage, Schedule, Analysis 등)에 완전히 국한되어야 한다.
- **Core Features:** 식약처 공공데이터 기반 영양제 카탈로그 검색, 성분 상호작용 분석(DUR API, Gemini 활용), 복용 시간(아침/저녁/취침전) 스케줄링.

## 2. Tech Stack Boundaries
- **Frontend Strictness:** 외부 UI 프레임워크나 가상 DOM 기술 없이, 오직 순수 Vanilla JavaScript (ES Modules), HTML, CSS만을 엄격하게 사용하여 구현한다.
- **Bundler:** Vite (^6.2.0). 개발 서버 포트 5173, `/api` 경로는 localhost:3001로 프록시.
- **Backend:** 로컬 개발 환경은 Express 5 (`server.js`), 프로덕션은 Vercel Serverless Functions (`api/`)를 사용한다.
- **Database:** Supabase (PostgreSQL) + localStorage (오프라인 폴백).
- **Authentication:** Supabase Auth (Google OAuth, Kakao OAuth).
- **AI Engine:** Google Gemini 2.5 Flash — 성분 과다/충돌 분석 + 라벨 이미지 OCR.
- **External APIs:**
  - 식품의약품안전처 건강기능식품정보 (data.go.kr) — 영양제 카탈로그
  - 식품의약품안전처 DUR 병용금기 서비스 — 성분 간 충돌 조회
  - 식품안전나라 개별인정형 원료 정보 — 원료 상세

## 3. Architecture & State Management
- **Single Page Application:** `main.js`가 라우터, 상태(State), 렌더링을 모두 담당하는 단일 컨트롤러 패턴이다.
- **State Object:** 전역 `state` 객체를 통해 상태를 관리하며 외부 상태 관리 라이브러리(Redux, Zustand 등)를 사용하지 않는다.
- **Data Sync Layer:** In-Memory (`state`) ↔ localStorage ↔ Supabase (로그인 유저 한정) 간의 동기화 흐름을 유지하라.
- **Rendering:** Virtual DOM이 없으며, `app.innerHTML`을 통째로 교체하는 String Template 방식을 사용한다.
- **Service Worker:** `sw.js`를 통한 복용 알림 푸시 기능이 존재한다. `services/reminder.js`에서 관리.

## 4. Coding Conventions
- **Component Pattern:** 페이지 1개당 1개의 JS 파일 (`components/*.js`). `export function renderXxx()` 형태로 HTML 문자열을 반환하라.
- **Private Functions:** 컴포넌트 내부 헬퍼 함수는 `_renderXxx()` 형태로 언더스코어 접두사를 사용한다.
- **Event Binding:** 인라인 이벤트 핸들러를 사용한다 (`onclick="window.app.methodName()"`).
- **Naming:**
  - 파일명: `lowercase.js` (예외: `publicData.js` 등 camelCase 허용)
  - CSS 클래스: `kebab-case`
  - JS 함수/변수: `camelCase`
  - 상수: `UPPER_SNAKE_CASE`
  - localStorage 키: `medicheck_` 또는 `pillstack_` 접두사 + `snake_case`
- **CSS Structure:** `src/styles/` 디렉토리에 7개 파일로 분리 (base, layout, components, home, search, features, icons).

## 5. Critical Development Warnings
- **Dual Backend Maintenance:** 로컬 개발용 `server.js`와 프로덕션용 `api/` 디렉토리에 동일한 로직이 존재한다. API 엔드포인트나 백엔드 로직 수정 시, **반드시 양쪽을 동기화**하도록 제안하라.
- **AI Analysis Engine:** 분석 엔진(`src/engine/analyzer.js`) 수정 시 Local Rule → DUR API → Gemini 2.5 Flash로 이어지는 3단계 파이프라인의 점수 산출 공식 원형을 보존하라.
- **OCR 프로덕션 미포팅:** 카메라 라벨 인식(`/api/ocr/analyze`)은 `server.js`에만 구현되어 있고, Vercel Serverless(`api/`)에는 미포팅 상태다. 이 기능을 프로덕션에서 동작시키려면 별도의 Serverless Function 추가가 필요하다.
- **레거시 CSS 파일:** `src/style.css` (62KB)는 미사용 레거시 파일이다. 실제 스타일은 `src/styles/` 디렉토리의 분리된 파일들이 담당한다. 이 파일을 수정하지 말 것.
- **카테고리 런타임 분류:** `supplements_catalog` 테이블에 category 컬럼이 없다. 제품명 키워드 매칭(`CATEGORY_RULES`)으로 런타임 분류하므로, 카테고리 관련 로직 변경 시 `server.js`와 `api/supplements/search.js` 양쪽의 규칙을 동기화하라.
