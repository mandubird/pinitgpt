# pinitgpt

ChatGPT 대화 메시지를 Pin으로 저장·관리하는 Chrome 확장.

- **사이드바**: 보기(전체 / 현재 채팅 / 📌 이어서), 검색(Pro), 정렬(최신·오래된순), 카테고리 필터. Pro 잠금 기능은 보이되 잠금 + 클릭 시 업그레이드 안내.
- **명세**: [docs/SIDEBAR_SPEC.md](docs/SIDEBAR_SPEC.md) 참고. **크롬 웹스토어**: [기능 정의서](docs/CHROME_STORE_FEATURES.md) · [등록 체크리스트](docs/CHROME_STORE_CHECKLIST.md) (manifest, icons, content, popup, background, locales).
- **다국어(i18n)**: 기본 언어 영어. `locales/en.json`, `locales/ko.json` + `t(key)`. 사이드바 하단 **🌐 언어 선택(English/한국어)** 으로 즉시 전환. 상세 → [docs/I18N.md](docs/I18N.md).
- **내보내기**: CSV / Notion(MD)에 `label`, `chatTitle`, `text`, `tags`, `createdAt` 포함. chatTitle은 좌측 사이드바 채팅 제목 기준.

**최종 검증**: View All 리스트 표시, chatTitle(사이드바 우선), tags 호환(parseTags), 사이드바 이벤트 null 체크 반영. 린트·manifest 검증 완료.

---

**다른 개발 하다가 여기 왔으면 → [docs/START_HERE.md](docs/START_HERE.md) 부터 보기.**

(뭐부터 볼지, 문서 맵, 다음 할 일이 정리되어 있음)
