# PinitGPT 사이드바 필터·검색·정렬 명세

사이드바 보기(Filter), 검색(Search), 정렬(Sort) 동작과 Pro/Free 권한 처리.  
**UI 문구**: 다국어(i18n) 적용. `t(key)` + `locales/en.json`, `locales/ko.json` — 상세 [I18N.md](I18N.md).

---

## 1. 보기 (Filter)

- **버튼**: `[전체]` `[현재 채팅]` `[📌 이어서]` — 단일 선택, 하나만 활성.
- **filterMode**: `"all"` | `"current"` | `"continue"`.

### 기본값

- **Free**: `"current"`만 사용 가능, 기본값 `"current"`.
- **Pro**: 기본값 `"all"`.

### 동작

| filterMode | 설명 | 식 |
|------------|------|----|
| 전체 (Pro 전용) | 저장된 모든 Pin | `filteredPins = allPins` |
| 현재 채팅 | 현재 conversationId와 같은 Pin만 | `filteredPins = allPins.filter(pin => pin.conversationId === currentConversationId)` |
| 📌 이어서 (Pro 전용) | 이어서 볼 Pin만 | `filteredPins = allPins.filter(pin => pin.isContinue === true)` |

### Pro 잠금 UX

- `[전체]`, `[📌 이어서]`는 **보이되 잠금** (흐리게 + 🔒).
- **Hover 툴팁**: "Pro에서 전체 Pin을 볼 수 있습니다" / "Pro에서 이어서 볼 Pin만 볼 수 있습니다".
- **클릭 시**: 작은 토스트 — "💎 Pro 전용 기능입니다. 모든 채팅의 Pin을 한 번에 관리하세요." + `[업그레이드]`.

---

## 2. 검색 (Search)

- **Pro 전용**. Free는 "🔒 Search (Pro)" 표시, 입력 비활성.
- 검색 대상: **title + content**. 대소문자 구분 없이 실시간 필터.
- **검색은 반드시 filter 적용 이후** 적용.

```js
if (state.keyword.trim() !== "") {
  filteredPins = filteredPins.filter(pin =>
    pin.title.toLowerCase().includes(state.keyword.toLowerCase()) ||
    pin.content.toLowerCase().includes(state.keyword.toLowerCase())
  );
}
```

- 검색어 강조: 노란색 배경 `.highlight`.
- 필터/정렬 변경해도 **keyword 유지**. 검색어 삭제 시 목록 전체 복구.

---

## 3. 정렬 (Sort)

- **sortMode**: `"latest"` | `"oldest"` (최신순 / 오래된순).
- **항상 마지막 단계**에서 적용. 순서: **filter → search → sort → 렌더링**.

```js
filteredPins.sort((a, b) => {
  if (state.sortMode === "latest") return b.createdAt - a.createdAt;
  return a.createdAt - b.createdAt;
});
```

- 키워드 입력해도 **선택한 sortMode 유지** (relevance 정렬로 바꾸지 않음).

---

## 4. Pin 데이터 구조

```ts
{
  id: string;
  conversationId: string;
  chatTitle?: string;   // 저장 시 좌측 사이드바 채팅 링크 텍스트 (내보내기·출처 라벨용)
  title: string;
  content: string;
  category: string;
  isContinue: boolean;
  createdAt: number;
  // 호환: chatId, text, label, type, tags(문자열 또는 배열), isStarred 등. tags는 parseTags()로 통일 사용.
}
```

- 기존 `chatId` → `conversationId`, `text` → `content`, `label` → `title`, `type === "continue"` → `isContinue` 로 정규화하여 사용.

---

## 5. Free / Pro 요약

| 구분 | Free | Pro |
|------|------|-----|
| filterMode | `current`만 | `all` / `current` / `continue` (기본 `all`) |
| Search | 🔒 Search (Pro), 비활성 | 검색 활성, title+content 검색 |
| 보기 버튼 | [전체], [이어서] 잠금 표시, 클릭 시 업그레이드 토스트 | 모두 활성 |

---

## 6. UX 디테일

- 필터 변경 시 리스트 **scrollTop = 0**.
- 검색어 삭제 시 전체 목록 복구.
- 필터/정렬 변경해도 keyword 유지.
- **결과 0개**: "검색 결과가 없습니다" 표시 (번역 키 `no_results`).

---

## 7. 언어 선택 (사이드바 하단)

- **표시**: 맨 하단에 `🌐 English` 또는 `🌐 한국어` (현재 로케일 기준).
- **클릭**: 드롭다운 표시 — **English** / **한국어**.
- **선택 시**: `pinitgpt_locale` 저장 → locale JSON 재로드 → `refreshSidebarI18n()` + `renderPins()` 로 전체 UI 문구 즉시 재렌더. **페이지 새로고침 없음**.
- 기본 언어는 영어. `navigator.language` 가 `ko` 이면 초기값 한국어.
- 구현: `#pinitgpt-lang-wrap`, `#pinitgpt-lang-trigger`, `#pinitgpt-lang-dropdown`, `setLocaleAndRefresh()`, `refreshSidebarI18n()`.

---

## 8. 구현 참고 (데이터·안정성)

- **View All 리스트 표시**: `filterMode === "all"` && `currentFilter === "all"` 일 때 `filtered`가 비어 있으면 `allPins`로 복구. 리스트 영역은 `#pinitgpt-list-wrap`(flex, min-height, overflow-y: auto)로 감싸 스크롤 보장. Pro 로드 지연 시 All 버튼이 active면 `filterMode` 덮어쓰지 않음.
- **채팅 제목(chatTitle)**: 저장·내보내기에는 **현재 채팅 ID와 일치하는 좌측 사이드바 `a[href*='/c/']` 링크의 textContent**를 우선 사용. `getConversationTitleFromPage(conversationId)`는 전체 보기 시 출처 라벨에 사용.
- **tags 호환**: `parseTags(tags)` — 문자열이면 `split(',')`, 배열이면 정규화, 그 외 빈 배열. 태그 필터·리스트 렌더·CSV/Notion 내보내기에서 사용. 예전에 배열로 저장된 Pin도 오류 없이 표시.
- **사이드바 이벤트**: `#clear-tag`, `#clear-all-pins`, `#pinitgpt-export-csv`, `#pinitgpt-export-notion` 등 querySelector 결과에 null 체크 후 onclick 할당.
