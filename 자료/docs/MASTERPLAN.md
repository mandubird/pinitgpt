# pinitgpt 마스터플랜 (Zero to One)

유/무료 기능, 스토어 등록, Gumroad, 마케팅 전략을 담은 런칭 플랜.

**다국어(i18n)**: 기본 언어는 영어. UI는 모두 `t(key)` + `locales/en.json`, `locales/ko.json` 로 관리. `navigator.language` 자동 감지. **사이드바 맨 하단 언어 선택(🌐 English / 한국어)** 으로 즉시 전환, 새로고침 없이 반영. **Pro+ 개발 시점에 일본어(ja)·독일어(de) 추가 예정.** 상세 → **docs/I18N.md**.

---

## ⚠️ 전환 시점 (기준)

**Pro / Early Supporter 1,000개 판매** = 이 시점부터 **월정액 Pro ($4.99/mo) 개발** 진행.

- 상세 로드맵·플랜 비교표·Phase 3~4 기술 스펙 → **`docs/ROADMAP_FULL.md`** 참고.

---

## 🎯 목표

- 무료 사용자 최대 확보
- 유료 전환이 자연스럽게 느껴지는 구조
- 스토어 승인 1회 통과, 설치 → 사용 → 유료 전환까지 자연 흐름

---

## ✅ 무료 버전 (MVP + 확산용)

| 항목 | 내용 |
|------|------|
| Pin 버튼 | 항상 표시 |
| Pin → 팝업 | 유형 선택: 🔵 개발중, 🔴 해결필요, 🟢 다시보기, 🟡 참고자료, 📌 이어서 (명세: docs/SIDEBAR_SPEC.md) |
| 사이드바 | 보기 [전체 \| 현재 채팅 \| 📌 이어서], 검색(Pro), 정렬 최신/오래된순, 카테고리 필터, 클릭 → 해당 메시지 스크롤 |
| 저장 | 로컬(localStorage), **프로젝트 1개, Pin 5개** |
| 제한 시 | 팝업·Pro 잠금 토스트(업그레이드 링크)로 유료 전환 유도 |

---

## 🔒 Pro / Shadow Pro

### 📁 Shadow Pro (개발만, UI 숨김)

미리 만들어두기: `starred`, `tags`, `color`, `archived`, `sortKey` 확장 구조.

### 🔒 Pro (UX 트리거 기반 노출)

| 기능 | Pro 노출 타이밍 |
|------|------------------|
| Pin 개수 제한 해제 | 20개(또는 5개) 초과 시 |
| ⭐ 중요(Star) | Star 클릭 시 |
| 태그 무제한 | 3개 이상 추가 시 |
| 색상 커스터마이징 | 색상 버튼 클릭 시 |
| 고급 정렬 | "정렬 더보기" 클릭 시 |
| 삭제/아카이브 | 삭제 클릭 시 |
| 클라우드 동기화 | 설정 진입 시 |

---

## 3️⃣ UX 트리거 (결제 유도)

### 프로젝트 2개 만들려 할 때

- **메시지**: "여러 작업을 관리하는 분들을 위한 기능입니다" + [Pro로 확장]
- **가장 강력한 전환 포인트**

### Pin 6번째 저장 시

- **문구**: "이 프로젝트의 Pin이 가득 찼어요. 무료: 5개 / Pro: 무제한" + [Pro로 계속 저장]

### 결제 문구 원칙

- ❌ "결제하세요", "Pro로 업그레이드"만 단독 사용
- ✅ "자주 쓰는 기능은 Pro에서 잠금 해제", "기능 설명 = 결제 설명"

### 결제 버튼 위치 (최소 3곳)

1. 🔒 기능 클릭 시
2. Pin 개수 초과 토스트
3. 설정 → Pro 소개 섹션

---

## 4️⃣ 데이터 구조 (목표)

```ts
type Project = {
  id: string;
  name: string;
  createdAt: number;
};

type Pin = {
  id: string;
  projectId: string;  // 없으면 나중에 구조 뒤집어야 함
  chatId: string;
  messageId: string;
  type: PinType;
  starred?: boolean;   // Pro
  tags?: string[];     // Pro
  color?: string;      // Pro
  archived?: boolean;  // Pro
  createdAt: number;
};
```

### Feature Flag

```js
const LIMITS = {
  FREE: { PROJECTS: 1, PINS_PER_PROJECT: 5 },
  PRO:  { PROJECTS: Infinity, PINS_PER_PROJECT: Infinity },
};

function canCreateProject(user, projects) {
  return user.isPro || projects.length < LIMITS.FREE.PROJECTS;
}
function canAddPin(user, pinsInProject) {
  return user.isPro || pinsInProject.length < LIMITS.FREE.PINS_PER_PROJECT;
}
```

---

## 💰 Gumroad

### 상품 (Early Supporter)

- **상품명**: pinitgpt – Early Supporter Lifetime Access
- **가격**: $4.99 (one-time)
- **요약**: ChatGPT 대화를 프로젝트 단위로 정리하는 Pin 도구, 초기 사용자 평생 Pro 이용권.
- **1000명 한정** → 이후 월 $4.99 구독 전환.

### 라이선스 구조 (기술)

```ts
type License = {
  type: 'FREE' | 'LTD' | 'SUB';
  source?: 'gumroad' | 'stripe';
};

function isPro(license) {
  return license.type === 'LTD' || license.type === 'SUB';
}
// LTD는 절대 SUB로 바꾸지 않는다.
```

### 결제 버튼 카피

- **Early 단계**: 🔓 Early Supporter Lifetime ($4.99)
- **이후**: 🔓 Pro – $4.99 / month

### 구매 완료 페이지 · License Key 설정 (Gumroad 셋업)

- **구매 완료(Receipt) 페이지에 "라이선스 키"가 표시되도록** 설정하면 됨.
- **Content 탭**: Insert → **[License Key]** 삽입, **Unique key per sale** 활성화.
- **Settings**:
  - **Limit number of uses per license**: 체크하지 않음 (또는 3~5회로 넉넉하게).
  - 단, 나중에 **API 호출 시** `increment_uses_count` 등으로 **카운팅 로직 적용**해 사용 횟수/기기 제한은 우리 쪽에서 관리 가능.

→ 결제 완료 시 구매자에게 키가 보이고, 그 키를 확장 프로그램 팝업에 입력해 Pro 활성화하는 흐름.

### Gumroad 키 제한 (보안 · 추후)

1. **API**: `increment_uses_count=true` → 키당 2~3회만 허용, 초과 시 무효화.
2. **기기 제한**: Browser fingerprint (UUID + 하드웨어 해시) 저장, 키당 2대.

### 1000명 카운트 UX

- ❌ 숫자 실시간 표시, "곧 마감"
- ✅ "Early Supporter Access는 일정 사용자 수 도달 시 종료됩니다. 현재는 Early 단계입니다." (숫자는 내부만)

### 1000명 도달 시 공지

- "Early Supporter 프로그램이 종료되었습니다. 지금부터는 월 구독 모델로 제공됩니다. Early Supporter 분들은 기존과 동일하게 평생 Pro를 사용하실 수 있습니다."

---

## 🛒 크롬 웹스토어

### 등록 준비

- **이름**: pinitgpt (또는 Pin it GPT - ChatGPT Bookmark & Project Manager)
- **한 줄 설명**: "대화 중 중요한 메시지를 Pin으로 저장하고, 다시 찾아보세요."
- **상세**: 문제(대화 길고 찾기 어려움) → 해결(Pin + 유형 + 이어서 보기)
- **아이콘**: 16 / 48 / 128px
- **스크린샷**: Pin 버튼, 유형 선택 팝업, 사이드바 목록 (최소 3장)

### 승인 포인트

- 과도한 권한 ❌, 외부 서버 통신 ❌(초기), 개인정보 수집 ❌, 광고/추적 ❌
- 설명과 기능 100% 일치

### 기술 (Phase 1)

- **CORS**: `manifest.json`에 `https://api.gumroad.com/*` 호스트 권한 추가 (키 검증 시).
- **개인정보 섹션**: "이 확장 프로그램은 개인을 식별할 수 있는 정보를 수집하지 않습니다."
- **라이선스 설명**: "Pro 기능 활성화를 위해 결제 여부 확인이 일시적으로 수행될 수 있습니다. (하드웨어/핑거프린트 수집 없음)"

### ASO 키워드

- ChatGPT productivity, ChatGPT bookmark, ChatGPT pin

---

## 🌱 Early Supporter 전용 UX

- **뱃지**: 사이드바 하단 및 설정 화면
- **문구**: "이 라이선스는 만료되지 않습니다.", "Early Supporter"
- **활성화 토스트**: "🎉 Pro 활성화 완료! Early Supporter 평생 이용권이 적용됨."
- **설정 전용**: "당신은 Pin it GPT의 초기 사용자입니다. ✔ Pro 기능 활성화됨 ✔ 추가 결제 없음 ✔ 이 라이선스는 만료되지 않습니다."

---

## 📣 마케팅

- Product Hunt, Twitter/X 빌드 로그, Reddit (r/ChatGPT, r/productivity), 국내 개발자 커뮤니티
- "ChatGPT 생산성 확장" SEO
- Soft launch → 피드백 → 리뷰 10개 확보 후 본격 노출

---

## 🌍 한국 vs 글로벌

- **제품**: 영어 UI 기본 (글로벌)
- **마케팅**: 한국어 설명 보조
- **가격**: $4.99 동일 (약 6,000원 언급만)
- Gumroad 설명 + 커뮤니티는 로컬 활용

---

## 📅 Phase 요약

| Phase | 시점 | 내용 |
|-------|------|------|
| 1 | D-3 ~ | 개발·UX 점검, CORS/보안, Early Supporter UX |
| 2 | D-2 | Gumroad 상품/설명/라이선스 키 설정 |
| 3 | D-1 | 크롬 웹스토어 등록·심사 문구 |
| 4 | D-Day | 마케팅, 제한 메시지(Soft CTA), 리뷰 유도 |

---

*이 문서는 마스터플랜 참조용입니다. 실제 구현 상태는 코드와 GAP 체크리스트를 참고하세요.*
