# pinitgpt MVP 무료 제한 + Pro 잠금 설계

## 1️⃣ 구조 분석

### content.js 전체 구조 (단계별)

| 구간 | 역할 | 함수/상수 |
|------|------|-----------|
| **상단** | 저장 키, 필터/정렬 상태, Pro 플래그 상수 | `STORAGE_KEY`, `currentFilter`, `currentSort`, `currentTagFilter`, `FEATURES`, `user`, `isPro(feature)` |
| **유틸** | 채팅·핀 읽기/쓰기 | `getChatId()`, `getPins()`, `savePins()` |
| **사이드바** | 우측 패널 생성·이벤트 바인딩 | `createSidebar()` |
| **모달** | 2단계(유형→태그/별) + 저장 처리 | `showCategoryPopup()` → `renderStep1`, `renderStep2`, `#save-final-btn` onclick |
| **렌더** | 필터/정렬 반영, 카드 목록 그리기 | `renderPins()` |
| **주입·감시** | 메시지에 📌 버튼, 채팅 전환 감지 | `addPinButtons()`, `observeDOM()`, `watchChat()` |
| **진입점** | 스크립트 로드 시 1회 실행 | `createSidebar(); renderPins(); observeDOM(); watchChat();` |

### Pin 저장 → 렌더링 → 이동 흐름

1. **저장**: 사용자가 📌 클릭 → `showCategoryPopup(msg, text)` → Step1 유형 선택 → Step2 태그/별 입력 → `#save-final-btn` 클릭 시 `getPins()` → `p.push({...})` → `savePins(p)` → `renderPins()` → 오버레이 제거.
2. **렌더링**: `renderPins()`가 `getPins()`로 전체 핀 조회 → `p.chatId === CHAT_ID`로 현재 채팅만 필터 → `currentFilter`/`currentTagFilter`/`currentSort` 적용 → `pinitgpt-list`에 카드 DOM 생성·이벤트 바인딩.
3. **이동**: 카드의 `.p-txt` 클릭 → `document.querySelector(\`[data-pinit-id="${p.messageId}"]\`)`로 해당 메시지로 스크롤 + 하이라이트.

### 무료 제한 삽입 위치 (안전 우선)

- **Pin 5개 초과 방지**: `showCategoryPopup` 내부 `#save-final-btn` onclick **한 곳**에서만 검사.  
  기존 `pinCount >= FEATURES.PIN_LIMIT` 조건을 **무료일 때만** 5개로 제한하고, Pro면 제한 없음.
- **프로젝트 1개 초과 방지**: 같은 `#save-final-btn` onclick에서, 저장 직전에  
  `getPins()`로 전체 핀의 `chatId` 목록을 구한 뒤, 무료이고 이미 다른 `chatId`에 핀이 있으면 현재 `CHAT_ID`가 그 목록에 없을 때 **저장 차단**.  
  (즉, 무료 = “핀을 가진 채팅이 1개뿐”이고, 그 채팅이 현재 채팅이어야 함.)
- **Pro 여부**: **저장·Star·태그 개수**를 쓰는 모든 경로에서 `user.isPro`를 사용하되, 이 값은 `chrome.storage.local`에서 로드·동기화.  
  기존 `isPro(feature)` 유지, 내부에서 `user.isPro` 참조하면 됨.

→ **DOM/함수 시그니처/사이드바 구조 변경 없음.**  
→ **Diff는 상단 Pro 로드 + `#save-final-btn` 내부 조건만 추가/수정.**

---

## 2️⃣ 라이센스 설계

### isProUser()

- **역할**: 현재 확장이 Pro 라이센스로 활성화되었는지 여부 반환.
- **구현**: `user.isPro`를 반환. `user.isPro`는 아래 저장소와 동기화.

### 라이센스 키 저장 구조

- **키**: `pinitgpt_license` (단일 키).
- **위치**: `chrome.storage.local`.
- **값**: 문자열(라이센스 키). 빈 문자열/미설정 = 무료.
- **조건**: 서버 검증 없음(로컬 검증만). 키가 비어 있지 않으면 Pro로 간주.

### Pro 여부 판별

- **초기 로드**: content 스크립트 실행 시 `chrome.storage.local.get(['pinitgpt_license'], callback)`로 읽어서 `user.isPro = !!(r && r.pinitgpt_license)` 설정.
- **실시간 반영**: `chrome.storage.onChanged.addListener`로 `pinitgpt_license` 변경 시 `user.isPro` 갱신.
- **기존 코드**: `isPro(feature)`는 그대로 두고, `user.isPro`만 위 방식으로 채움.

### 무료 제한 방어 로직

| 제한 | 검사 시점 | 조건 |
|------|-----------|------|
| Pin 최대 5개 | `#save-final-btn` 클릭 시 | `!isProUser() && pinCount >= 5` → 저장 차단, 토스트 메시지 |
| 프로젝트 1개 | `#save-final-btn` 클릭 시 | `!isProUser() && 기존 핀의 chatId 집합 크기 >= 1 && 현재 CHAT_ID가 그 집합에 없음` → 저장 차단, 토스트 메시지 |
| 태그 3개 | 기존 유지 | `!isPro("TAG_UNLIMITED") && tags.length > 3` |
| Star | 기존 유지 | `!isPro("STAR")` 시 잠금 토스트 |

- **성능**: 저장 전 1회 `getPins()` 호출로 pinCount·chatId 집합 계산. 추가 네트워크/스토리지 호출 없음.

---

## 3️⃣ Diff 코드 제안

### [추가] content.js 상단 — 라이센스 상수·Pro 상태 로드

**추가 위치**: `const user = { isPro: false };` 바로 아래(기존 `isPro` 함수 위).

```javascript
const LICENSE_STORAGE_KEY = "pinitgpt_license";

function isProUser() { return !!user.isPro; }

function loadProState() {
  try {
    chrome.storage.local.get([LICENSE_STORAGE_KEY], function (r) {
      user.isPro = !!(r && r[LICENSE_STORAGE_KEY]);
    });
  } catch (e) { user.isPro = false; }
}
loadProState();
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === "local" && changes[LICENSE_STORAGE_KEY]) {
      user.isPro = !!changes[LICENSE_STORAGE_KEY].newValue;
    }
  });
}
```

**기존 코드 영향**: 없음. `isPro(feature)`는 그대로 `user.isPro`를 참조.

---

### [수정] content.js — 저장 시 무료 제한 (Pin 5개 + 프로젝트 1개)

**수정 위치**: `modal.querySelector("#save-final-btn").onclick = () => { ... };` 블록 내부, 기존 `pinCount` 검사 부분을 아래로 교체.

**기존 코드**:
```javascript
modal.querySelector("#save-final-btn").onclick = () => {
    const pinCount = getPins().filter(p=>p.chatId===CHAT_ID).length;
    if(!user.isPro && pinCount >= FEATURES.PIN_LIMIT) { pinLimitToast.innerText = `핀은 ${FEATURES.PIN_LIMIT}개까지만 가능합니다.`; return; }

    let raw = input.value.trim();
```

**교체 코드**:
```javascript
modal.querySelector("#save-final-btn").onclick = () => {
    pinLimitToast.innerText = "";
    tagLimitToast.innerText = "";
    const pins = getPins();
    const pinCount = pins.filter(p=>p.chatId===CHAT_ID).length;
    const projectChatIds = [...new Set(pins.map(p=>p.chatId))];

    if (!isProUser()) {
      if (pinCount >= 5) { pinLimitToast.innerText = "무료는 핀 5개까지 가능해요. Pro로 무제한 사용하세요."; return; }
      if (projectChatIds.length >= 1 && !projectChatIds.includes(CHAT_ID)) { pinLimitToast.innerText = "무료는 한 프로젝트(채팅)만 사용할 수 있어요."; return; }
    }

    let raw = input.value.trim();
```

그 다음 줄의 `const p = getPins();`는 **그대로 두고**, 그 아래 `p.push(...)`만 유지. (이미 위에서 `pins`를 썼지만, 저장 직전에 다시 `getPins()`로 최신 상태를 쓰려면 `const p = getPins();` 유지 권장. 일관성을 위해 `const p = getPins();` 다음에 `p.push(...)` 있는 부분은 그대로 두면 됨.)

**기존 코드 (그 다음 블록)**:
```javascript
          const tagStr = tags.join(',');
          const p = getPins();
          p.push({ id: crypto.randomUUID(), ...
```
→ `const p = getPins();` 유지. (한 번만 검사하므로 위에서 `pins`로 검사하고, 저장 시에는 `getPins()`로 다시 읽어서 push하는 현재 방식 유지.)

**기존 코드 영향**: 최소. 같은 모달 내 토스트만 사용, DOM 구조 변경 없음.

---

## 4️⃣ 무료 제한 UX 문구 제안

| 상황 | 문구 (선택) |
|------|-------------|
| Pin 5개 초과 | "무료는 핀 5개까지 가능해요. Pro로 무제한 사용하세요." / "핀을 더 쓰려면 Pro로 업그레이드하면 돼요." |
| 프로젝트 2개째 저장 시도 | "무료는 한 프로젝트(채팅)만 사용할 수 있어요." / "지금은 이 대화에만 핀을 저장할 수 있어요. 다른 대화도 쓰려면 Pro를 켜주세요." |
| Star 잠금 | "[🔒 Pro] 중요 표시는 Pro에서 사용할 수 있어요." (기존 유사 문구 유지) |
| 태그 3개 초과 | "무료는 태그 3개까지예요. Pro에서 무제한 태그를 쓸 수 있어요." |

**톤**: 부드럽고 생산성 강조. “지금 사면 평생 Pro” 같은 Early Supporter 문구는 popup/설정 쪽에 두고, 제한 토스트는 짧고 명확하게.

---

## 5️⃣ Pro 전환 설계

### popup.html — 라이센스 입력 UI

- **추가 요소**:  
  - Pro 상태 표시: "Pro 활성화됨 ✓" 또는 "무료 사용 중"  
  - 입력 필드: placeholder "Gumroad 라이센스 키 입력"  
  - 버튼: "활성화" (저장 시 `chrome.storage.local.set({ pinitgpt_license: key })`)  
  - (선택) "Pro 해제" 버튼: 키 삭제 시 `user.isPro`는 onChanged로 자동 false.
- **manifest**: `action.default_popup: "popup.html"`, `permissions: ["storage"]` 추가.

### Pro 활성화 시 UI 변화

- **사이드바**: 기존 DOM 구조 유지. 상단 h3 옆에 작은 뱃지 "Pro" 텍스트만 추가해도 됨. (선택)
- **모달**: 잠금 토스트 비표시, 태그/Star 제한 해제. (이미 `isPro(feature)`로 제어되므로 코드만 Pro 상태만 맞추면 됨.)

### Pro 배지 표시 위치 제안

- **옵션 A**: 사이드바 제목 옆 — `<h3>…</h3>` 안에 `<span class="pinitgpt-pro-badge">Pro</span>` 추가. `isProUser()`일 때만 표시. (renderPins 호출 시점에 사이드바는 이미 있으므로, 배지는 `createSidebar` 직후 한 번 + storage 변경 시 한 번 갱신하려면 별도 작은 함수로 배지 visibility 제어.)
- **옵션 B**: popup에서만 "Pro 활성화됨" 표시. content 쪽 DOM 변경 최소화.
- **권장**: 우선 **옵션 B**로 출시하고, 안정화 후 옵션 A 추가. (규칙: 사이드바 UI 깨지면 안 됨.)

---

## 6️⃣ 다음 단계 제안

1. **적용 순서**: manifest에 `storage` + `action.default_popup` 추가 → content.js에 Pro 로드 + 무료 제한 Diff 적용 → popup.html에 라이센스 입력 UI + Pro 상태 표시 추가.
2. **검증**: 무료 상태에서 Pin 5개·다른 채팅 저장 시도 → 토스트 확인. Pro 키 저장 후 동일 동작 → 제한 해제 확인.
3. **배지**: popup Pro 문구 적용 후, 필요 시 사이드바 Pro 배지는 별도 작은 패치로 추가.

---

---

**참고**: 현재 사이드바 보기(필터)·검색·정렬·Pro 잠금 UX는 **docs/SIDEBAR_SPEC.md** 에 정리되어 있음.

*문서 끝. 실제 코드 반영은 동일 설계로 Diff만 적용함.*
