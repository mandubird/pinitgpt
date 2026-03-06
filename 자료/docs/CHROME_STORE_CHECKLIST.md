# Chrome 웹스토어 등록 체크리스트

등록 시 **제출 패키지에 포함·확인할 파일/폴더** 정리.

---

## 1. 필수 포함 항목 (패키지에 들어가야 하는 것)

| 항목 | 경로 | 용도 |
|------|------|------|
| **manifest.json** | 프로젝트 루트 | 확장 메타데이터, 권한, 아이콘·팝업·content script 선언. 스토어가 먼저 검사하는 파일. |
| **icons** | `icons/` 폴더 | **16**, **48**, **128** px 아이콘. 스토어 상세 페이지·확장 관리 페이지·툴바 표시용. |
| **content.js** | 루트 | ChatGPT 페이지에 주입. 사이드바·Pin 버튼·모달·리스트 등 메인 UI. |
| **content_scripts** | manifest의 `content_scripts` | `content.js` 가 `matches`(chatgpt.com)에서 로드됨. |
| **popup.html** | 루트 | 확장 아이콘 클릭 시 열리는 팝업 UI. |
| **popup.js** | 루트 | 팝업 동작(라이선스 입력, Early Supporter 안내 등). |
| **background.js** | 루트 | service_worker. Gumroad 라이선스 검증 등 백그라운드 로직. |
| **locales** | `locales/` 폴더 | `en.json`, `ko.json` 등. 다국어 문자열. `web_accessible_resources`로 content에서 fetch. |

---

## 2. 요약 (등록 시 꼭 넣을 것)

- **manifest.json** — 설정·아이콘 경로·content script·popup·background 일치 여부 확인.
- **icons/** — `icon16.png`, `icon48.png`, `icon128.png` (manifest의 `icons`와 경로 일치).
- **content.js** — ChatGPT 페이지 동작.
- **popup.html** + **popup.js** — 확장 아이콘 클릭 시 팝업.
- **background.js** — 백그라운드(라이선스 검증 등).
- **locales/** — 다국어 JSON.

---

## 3. 참고

- **기능 설명·스크린샷**: [CHROME_STORE_FEATURES.md](CHROME_STORE_FEATURES.md) 참고.
- **아이콘**: 128px는 스토어 상세 페이지용으로 필수. 16/48은 확장 관리·툴바용.
