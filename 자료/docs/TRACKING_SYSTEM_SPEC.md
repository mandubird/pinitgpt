# PinItGPT — 추적 시스템 구축 개발 명세서 v1.0

> **작업 목적**: 기능 개발보다 데이터 수집 구조 먼저.
> **현재 상황**: 32명 설치, 유입 경로 0% 파악, 수익 $0
> **목표**: 30일 안에 판단 가능한 데이터 확보

---

## 다음 판단 기준 (30일 후)

아래 기준을 **모두** 충족하면 → 계속 밀어도 된다.

| 지표 | 목표 |
|---|---|
| 랜딩페이지 방문자 | 500명 이상 |
| 설치 전환율 | 10% 이상 (방문 → 설치) |
| 신규 설치 | 50~100명 |
| 피드백 응답 | 10개 이상 |
| 유료 전환 | 3명 이상 |

**판단 로직**
- 전부 충족 → 계속 개발 + 마케팅 투자
- 방문 500 이상인데 설치 10% 미만 → 랜딩페이지 메시지 문제
- 방문 500 미만 → 마케팅 채널 문제 (콘텐츠 더 필요)
- 피드백 "No 다수" → 포지션 재설계 필요

---

## 작업 1 — 랜딩페이지 (pinitgpt.com)

### 목적
1. 유입 경로 추적 (UTM + GA4)
2. 전환율 측정 (방문 → 설치)
3. Painkiller 포지셔닝 메시지 검증
4. 이메일 수집 (선택)

> **중요 규칙**: 이제부터 Reddit, IndieHackers, Product Hunt 등 모든 외부 링크는 **랜딩페이지로만** 보낸다. Chrome Web Store 직접 링크 금지.

---

### 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | Vercel 최적화 |
| 배포 | Vercel | 무료, 빠름 |
| 분석 | GA4 | UTM 자동 수집 |
| 폼 | Tally 또는 Google Form | 무료 |
| 이메일 수집 | MailerLite 또는 ConvertKit | 선택사항 |

---

### URL 구조

```
pinitgpt.com
├── /              ← 메인 랜딩페이지
├── /privacy       ← 개인정보처리방침
└── /terms         ← 이용약관
```

---

### 페이지 섹션 설계

#### 🔹 Hero Section

**헤드라인** (결과 중심)
```
Organize ChatGPT. Reuse Prompts. Save Hours Every Week.
```

**서브텍스트**
```
Stop losing your best AI workflows.
```

**CTA 버튼**
```
Install Free →
```

버튼 클릭 시:
1. GA4 이벤트 발생
2. Chrome Web Store 페이지로 이동

```js
// 이벤트 트래킹 코드
gtag('event', 'click_install', {
  source: 'hero_button'
});
```

---

#### 🔹 Problem Section

공감 유도 (3가지 Pain Point)

```
❌ You lose important prompts
❌ You rewrite the same instructions over and over
❌ Your AI workflow is scattered and messy
```

---

#### 🔹 Solution Section

GIF 데모 1~2개 삽입

- Demo 1: 메시지에 마우스 올리면 📌 Pin 버튼 등장 → 클릭 → 사이드바에 저장
- Demo 2: 사이드바에서 카테고리별 정리 + 검색

---

#### 🔹 Social Proof Section

초기에는 숫자만 표시 (과장 없이)

```
30+ early users
Built by an indie maker
No account required
```

---

#### 🔹 CTA 반복 (하단)

```
Start Organizing ChatGPT Now  →  [Install Free]
```

---

### GA4 추적 이벤트 설계

| 이벤트명 | 발생 시점 |
|---|---|
| `page_view` | 페이지 로드 시 (자동) |
| `click_install` | Install 버튼 클릭 시 |
| `scroll_75` | 페이지 75% 스크롤 시 |
| `feedback_click` | Feedback 링크 클릭 시 |

---

### UTM 파라미터 구조

모든 외부 채널에 아래 형식으로 링크 생성:

```
https://pinitgpt.com/?utm_source=reddit&utm_medium=post&utm_campaign=launch1
https://pinitgpt.com/?utm_source=indiehackers&utm_medium=post&utm_campaign=launch1
https://pinitgpt.com/?utm_source=producthunt&utm_medium=referral&utm_campaign=launch1
https://pinitgpt.com/?utm_source=twitter&utm_medium=social&utm_campaign=launch1
```

GA4 → 획득 → 트래픽 소스에서 `source / medium / campaign` 확인 가능.

---

## 작업 2 — 확장프로그램 Feedback 버튼

### 목적
1. 유입 경로 파악 (어디서 알게 됐는지)
2. Pain Point 확인 (어떤 문제를 해결하려 했는지)
3. 유료 전환 의향 검증 ($5/월 지불 의향)

---

### UI 위치

사이드바 (`content.js`) 하단 고정 영역.
언어 선택 드롭다운(`#pinitgpt-lang-wrap`) 아래에 추가.

```
┌─────────────────────────────┐
│  ... 핀 목록 ...             │
│                             │
│  Export / Clear             │
│  🌱 Early Supporter         │
│  라이선스 키 입력            │
│  🌐 Language                │
│  ─────────────────────────  │  ← 여기 추가
│  💬 Help improve (1 min)    │
└─────────────────────────────┘
```

---

### UI 스펙

```html
<!-- content.js 사이드바 HTML에 추가 -->
<div id="pinitgpt-feedback-wrap"
     style="margin-top:10px; padding-top:10px; border-top:1px solid #1a1a1a;">
  <a id="pinitgpt-feedback-btn"
     href="https://forms.gle/XXXX"
     target="_blank"
     rel="noopener"
     style="
       display:flex;
       align-items:center;
       gap:6px;
       font-size:11px;
       color:#555;
       text-decoration:none;
       padding:6px 0;
       cursor:pointer;
       transition:color 0.2s;
     ">
    💬 <span>Help improve (1 min)</span>
  </a>
</div>
```

**hover 스타일**: color → `#00e5ff`

**클릭 동작**: `target="_blank"`로 Google Form 새 탭 오픈

---

### Google Form 질문 설계

**Form 제목**: PinItGPT — Quick Feedback (1 min)

---

**질문 1** (필수, 객관식)
```
Where did you find pinitgpt?

○ Reddit
○ Indie Hackers
○ Chrome Web Store search
○ Product Hunt
○ Friend / colleague
○ Other
```

---

**질문 2** (필수, 주관식 단답)
```
What problem were you trying to solve?
```

---

**질문 3** (필수, 객관식)
```
Would you pay $5/month for this?

○ Yes
○ Maybe
○ No
```

---

**질문 4** (선택, 주관식)
```
What feature would make this a must-have for you?
```

---

### 피드백 분석 기준 (10개 이상 응답 후 판단)

| 결과 | 판단 |
|---|---|
| "Yes" 30% 이상 | 가격 실험 진행 ($5/월 구독 테스트) |
| "Maybe" 다수 | 기능 개선 필요 — 어떤 기능인지 주관식 분석 |
| "No" 다수 | 포지션 재설계 필요 |
| 유입 "Reddit" 다수 | Reddit 마케팅 계속 |
| 유입 "Chrome Store 검색" 다수 | 키워드 최적화 집중 |

---

### i18n 추가 키

`locales/ko.json` 추가:
```json
"feedback_btn": "💬 개선 의견 보내기 (1분)"
```

`locales/en.json` 추가:
```json
"feedback_btn": "💬 Help improve (1 min)"
```

피드백 버튼 텍스트는 `t("feedback_btn")`으로 적용.

---

## 작업 순서

```
1단계 (이번 주)
  ① Google Form 생성 → URL 확보
  ② content.js에 Feedback 버튼 추가 (Form URL 연결)
  ③ 확장프로그램 버전 업데이트 → 웹스토어 배포

2단계 (이번 주)
  ④ Next.js 프로젝트 생성
  ⑤ 랜딩페이지 4개 섹션 구현
  ⑥ GA4 설치 + 이벤트 코드 추가
  ⑦ Vercel 배포
  ⑧ 도메인 연결 (pinitgpt.com)

3단계 (배포 직후)
  ⑨ 모든 외부 링크를 랜딩페이지 UTM 링크로 교체
  ⑩ Reddit / IndieHackers / Product Hunt 포스팅
```

---

## 수정 대상 파일 요약

| 파일 | 작업 내용 |
|---|---|
| `content.js` | Feedback 버튼 HTML + 이벤트 추가 |
| `locales/ko.json` | `feedback_btn` 키 추가 |
| `locales/en.json` | `feedback_btn` 키 추가 |
| `(신규) pinitgpt.com/` | Next.js 랜딩페이지 프로젝트 전체 |
