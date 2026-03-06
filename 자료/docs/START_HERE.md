# pinitgpt 돌아왔을 때 — 여기부터 보기

다른 개발 하다가 pinitgpt 프로젝트로 돌아오면 **이 파일부터** 보면 됨.

---

## 1. 30초 요약

- **뭔가**: ChatGPT 대화 메시지를 Pin으로 저장·분류하고, 프로젝트(채팅) 단위로 관리하는 **Chrome 확장**
- **지금 상태**: MVP 완료. 무료(5 Pin/1 채팅, 보기=현재 채팅만, Search 🔒) + Pro(보기 전체/이어서, 검색·정렬, Gumroad 키 검증). 다국어(en/ko) + **사이드바 하단 언어 선택(🌐)** 으로 즉시 전환. 사이드바 필터·검색·정렬 명세는 **docs/SIDEBAR_SPEC.md** 참고. **최근 검증 반영**: View All 시 리스트 표시, chatTitle(사이드바 링크 우선), tags 문자열/배열 호환(parseTags), 사이드바 버튼 null 체크.
- **다음 마일스톤**: Early Supporter **1,000개 판매** 시점에 **월정액 Pro ($4.99/mo)** 개발 시작.

---

## 2. 뭐부터 볼지 (순서)

| 순서 | 볼 것 | 용도 |
|------|--------|------|
| 1 | **이 파일 (START_HERE.md)** | 전체 맥락 복기 |
| 2 | **docs/ROADMAP_FULL.md** | Phase 1~4, 플랜 비교표, 1,000명 = 월정액 전환 시점 |
| 3 | **docs/LICENSE_STRATEGY.md** | 지금 단계: Gumroad verify, uses 3회. 이후: Worker·2기기 |
| 4 | **docs/SIDEBAR_SPEC.md** | 사이드바 보기·검색·정렬 명세, Pro 잠금 UX |
| 5 | **docs/GAP_CHECKLIST.md** | 지금 코드 기준으로 “된 것 / 안 된 것” 체크 (일부는 이미 반영됨) |
| 6 | **docs/I18N.md** | 다국어 구조(기본 영어, en/ko, t(key), 언어 추가 방법) |
| 7 | **코드**: `content.js` → `popup.js` → `background.js` | 실제 동작·검증 흐름 파악 |

---

## 3. 핵심 파일

| 파일 | 역할 |
|------|------|
| **content.js** | ChatGPT 페이지 주입. 사이드바(보기·검색·정렬·카테고리), Pin 버튼, 모달, Export, FREE/PRO 뱃지, Pro 잠금 토스트, 라이선스 입력, **사이드바 하단 언어 선택(🌐 드롭다운)**. **i18n**: `loadLocale()` → `t(key)`, `setLocaleAndRefresh()` / `refreshSidebarI18n()` 으로 언어 즉시 전환. (가장 큼) |
| **popup.html + popup.js** | 확장 아이콘 클릭 시. Early Supporter 섹션, 라이선스 입력, Gumroad 링크. **i18n**: `loadPopupLocale()` 후 `data-i18n` 등으로 문구 치환. |
| **background.js** | Gumroad API `licenses/verify` 호출. uses 3회 초과 시 실패. |
| **manifest.json** | 권한(storage, host_permissions gumroad), action(popup), content_scripts, background. |

---

## 4. 문서 맵 (무슨 문서가 뭔지)

| 문서 | 내용 |
|------|------|
| **START_HERE.md** (이거) | “돌아왔을 때 뭐부터 보나” 가이드 |
| **ROADMAP_FULL.md** | 전체 로드맵, Free/Pro/Pro+ 표, Phase 3~4, **1,000명 = 월정액 Pro 시작** |
| **MASTERPLAN.md** | 런칭용 요약(무료/Pro, Gumroad, 스토어, 마케팅). ROADMAP 상세는 ROADMAP_FULL 참고. |
| **LICENSE_STRATEGY.md** | 라이선스 전략: 지금(Gumroad verify, 3회) / 이후(Worker, 2기기, Cloud) |
| **GAP_CHECKLIST.md** | 마스터플랜 대비 구현 상태 (참고용, 일부 항목은 이미 반영됨) |
| **I18N.md** | 다국어 구조(기본 영어, en/ko, t(key), **사이드바 하단 언어 선택 UI**, 언어 추가 방법). **Pro+ 개발 시점**: 일본어(ja)·독일어(de) 추가 예정 (§6). |
| **SIDEBAR_SPEC.md** | 사이드바 필터·검색·정렬·Pro 잠금 명세 |
| **MVP_PRO_DESIGN.md** | MVP Pro 설계 당시 구조 분석·Diff·무료 제한 설계 |
| **PRO_FEATURES_REVIEW.md** | 클라우드 동기화·CSV/Notion 내보내기 검토 |
| **CHROME_STORE_FEATURES.md** | **크롬 웹스토어용** 무료/Pro 기능 정의서 (비교표, 상세 기능, 스토어 문구 예시) |
| **CHROME_STORE_CHECKLIST.md** | 스토어 **등록 시 제출 항목** 체크리스트 (manifest, icons, content.js, popup, background, locales) |
| **CURSOR_UI_TIP.md** | Cursor에서 폴더/코드 보이게 하는 방법 |

---

## 5. 다음에 할 일 (우선순위 예시)

- 스토어: 한 줄 설명, 스크린샷 3장+, 아이콘 16/48/128
- Gumroad: 상품 설명·License Key 노출 확인
- (선택) GAP_CHECKLIST에서 “아직 안 된 것” 중에서 골라서 진행
- **1,000명 도달 후**: ROADMAP_FULL Phase 3~4 보고 월정액 Pro 개발 시작

---

## 6. 최근 수정·검증 (최종본)

| 항목 | 내용 |
|------|------|
| **View All 리스트** | View > All + Category All 일 때 Pin 리스트가 비면 `allPins`로 복구. 리스트 영역 `#pinitgpt-list-wrap` flex/overflow로 항상 표시. Pro 로드 지연 시에도 All 버튼 선택 상태 유지. |
| **chatTitle** | 저장·내보내기 시 **좌측 사이드바의 해당 채팅 링크 텍스트**를 우선 사용. 페이지 본문 `<h1>`은 폴백만 사용해 잘못된 제목 저장 방지. |
| **tags 호환** | `parseTags(tags)`로 문자열/배열/기타 타입 안전 처리. 필터·리스트·CSV/Notion 내보내기에서 사용. `p.tags.split is not a function` 오류 방지. |
| **사이드바 이벤트** | `#clear-tag`, `#clear-all-pins`, `#pinitgpt-export-csv`, `#pinitgpt-export-notion`에 onclick 할당 전 null 체크. `Cannot set properties of null` 방지. |

---

**한 줄**: 돌아오면 **START_HERE → ROADMAP_FULL → LICENSE_STRATEGY** 순으로 보면 흐름 잡기 좋음.
