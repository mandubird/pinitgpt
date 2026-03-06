# 마스터플랜 대비 현재 상태 (GAP 체크리스트)

마스터플랜 기준으로 **이미 된 것**과 **아직 안 된 것** 정리.

---

## ✅ 이미 반영된 것

| 항목 | 상태 | 비고 |
|------|------|------|
| Pin 버튼 + 유형 선택 (🔵🔴🟢🟡📌) | ✅ | content.js |
| 사이드바 (보기·검색·정렬·카테고리, 클릭→스크롤) | ✅ | filterMode/sortMode, Pro 잠금 UX. 명세: SIDEBAR_SPEC.md |
| 로컬 저장 (localStorage) | ✅ | STORAGE_KEY |
| 무료: 프로젝트 1개(채팅 1개), Pin 5개 | ✅ | isProUser(), projectChatIds, pinCount |
| 제한 시 문구 ("무료는 한 채팅만…", "다른 채팅 핀 삭제") | ✅ | 모달 + 사이드바 안내 |
| 라이센스 키 입력 (popup) | ✅ | popup.html + popup.js |
| Pro 여부 = chrome.storage.local 키 유무 | ✅ | LICENSE_STORAGE_KEY, loadProState |
| Star/태그 Pro 잠금 (기존 isPro 플래그) | ✅ | UI는 있음, 무료 시 잠금 |
| 보기(전체/이어서) Pro 잠금 | ✅ | 잠금 표시·툴팁·클릭 시 업그레이드 토스트 |
| Search Pro 전용, 검색어 강조 | ✅ | Free: 🔒 Search (Pro), Pro: title+content 검색, .highlight |
| manifest: storage, action popup, all_frames false | ✅ | |
| 다국어(i18n) | ✅ | locales/en.json, ko.json, t(key), 기본 영어, navigator.language 감지. **사이드바 하단 언어 선택 UI**(🌐 English/한국어 드롭다운, 선택 시 즉시 반영, 새로고침 없음). docs/I18N.md |
| Pin 가득 참 문구 + CTA | ✅ | 모달에서 pin_limit_toast, pin_limit_continue 링크. "무료: 5개 / Pro: 무제한" + [Pro로 계속 저장] |
| Early Supporter 뱃지 (사이드바) | ✅ | 사이드바 하단 뱃지·툴팁("만료 없음"). Pro 사용자에게만 표시 |
| View All 리스트 표시 | ✅ | All+All일 때 filtered 복구, list-wrap flex/overflow, All 버튼 active 시 filterMode 유지 |
| chatTitle 정확도 (저장·내보내기) | ✅ | getCurrentChatTitle: 사이드바 링크 우선, h1 폴백. getConversationTitleFromPage로 출처 라벨 |
| tags 데이터 호환 | ✅ | parseTags()로 문자열/배열 안전 처리. 필터·리스트·CSV/Notion 내보내기 |
| 사이드바 버튼 이벤트 안정성 | ✅ | clear-tag, clear-all-pins, export-csv, export-notion에 null 체크 후 onclick |

---

## ⏳ 마스터플랜 대비 아직 없는 것

| 항목 | 마스터플랜 요구 | 현재 구조 | 제안 |
|------|-----------------|-----------|------|
| **Project 타입** | `Project { id, name, createdAt }` | 없음. Pin만 있고 `chatId`로 묶음 | 나중에 `projectId` 도입 시 마이그레이션 필요 |
| **Pin.projectId** | 모든 Pin에 projectId | Pin에 chatId만 있음 | 프로젝트 1개 = 채팅 1개로 매핑해 두었으므로, 프로젝트 도입 시 chatId→projectId 매핑 |
| **License 타입** | `FREE \| LTD \| SUB` | 키 문자열만 저장, 타입 없음 | Gumroad 검증 도입 시 `{ type, source }` 저장 구조로 확장 |
| **LIMITS 상수** | `FREE.PROJECTS: 1`, `PINS_PER_PROJECT: 5` | 숫자가 코드에 하드코딩 (5, projectChatIds.length) | 상수로 빼두면 유지보수·문구 일치에 유리 |
| **프로젝트 2개 차단 UX** | "여러 작업을 관리하는 분들을 위한 기능" + [Pro로 확장] | 프로젝트 개념 없음 (채팅 1개 = 1프로젝트) | 현재는 "다른 채팅 핀 삭제"로 대체. 프로젝트 UI 도입 시 트리거 추가 |
| **Early Supporter (설정)** | 설정 페이지에서 뱃지·만료 안내 | 설정 페이지 없음 | 사이드바·popup에는 있음. 설정 진입 시 노출은 추후 |
| **Gumroad API** | 키 검증, 사용 횟수 제한 | 로컬만. 키 있으면 Pro | 필요 시 manifest에 `api.gumroad.com`, 검증 로직 추가 |
| **CORS (Gumroad)** | `https://api.gumroad.com/*` | manifest에 host_permissions 등록됨 | background에서 verify 시 사용 |
| **스토어 설명/스크린샷** | 한 줄 설명, 3장 이상 | 미작성 | 문서만 있음 (MASTERPLAN 참고) |

---

## 🧱 우선 적용 추천 (코드 변경 최소)

1. **LIMITS 상수화**  
   `5`, `1`을 `LIMITS.FREE.PINS_PER_PROJECT`, `LIMITS.FREE.PROJECTS`로 치환. 문구도 "무료: 5개 / Pro: 무제한" 등으로 통일.

2. **Pin 5개 초과 시 CTA**  
   토스트에 "[Pro로 계속 저장]" 링크 추가 (Gumroad 또는 popup Pro 섹션으로 이동).

3. **Early Supporter 문구**  
   popup에 "이 라이선스는 만료되지 않습니다." 등 안내 한 줄 추가 (키가 있을 때만).

4. **데이터 구조**  
   당분간은 `chatId` = 1프로젝트 유지. 나중에 Project 테이블 도입 시 `projectId` 추가 + 마이그레이션 스크립트 검토.

---

원하면 LIMITS 상수화 + Pin 초과 시 "[Pro로 계속 저장]" 문구/링크부터 Diff로 제안할 수 있음.
