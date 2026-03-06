# Chrome 웹스토어 — 변경사항 (Release notes) v1.0.1

스토어 업로드 시 **"변경사항"** 란에 아래 내용을 복사해 넣으면 됩니다.

---

## 한국어 (간단)

```
• 블록 단위 Pin: 응답 문단/리스트/제목 등에 마우스를 올리면 📌로 해당 블록만 저장할 수 있습니다.
• 안정성 개선: Pin 데이터 호환 처리(chatId/conversationId) 및 저장소 오류 시 확장이 중단되지 않도록 수정했습니다.
• 성능 개선: 스트리밍 중 부하를 줄이기 위해 DOM 감시 간격을 조정했습니다.
```

---

## 한국어 (조금 더 상세)

```
[새 기능]
• 블록 단위 Pin: 메시지 전체가 아닌, 원하는 문단·리스트·제목·코드 블록만 골라서 저장할 수 있습니다. 해당 블록에 마우스를 올리면 나타나는 📌를 클릭해 저장하세요.

[안정성]
• Pin 저장/삭제·내보내기·무료 플랜 제한 계산이 이전 버전 데이터와도 안정적으로 동작하도록 수정했습니다.
• 저장 데이터가 손상된 경우에도 확장 프로그램이 중단되지 않도록 예외 처리를 추가했습니다.

[성능]
• ChatGPT 응답 스트리밍 중 불필요한 연산을 줄여, 페이지 반응성을 개선했습니다.
```

---

## English (Short)

```
• Block-level Pin: Hover over a paragraph, list, or heading in a response and click the 📌 to save just that block.
• Stability: Improved compatibility for existing Pin data (chatId/conversationId) and added error handling so the extension won’t crash if stored data is corrupted.
• Performance: Reduced load during streaming for a smoother experience.
```

---

## English (Detailed)

```
[New]
• Block-level Pin: Save only the part you need—hover over a paragraph, list item, heading, or code block and click the 📌 that appears to pin just that block.

[Stability]
• Pin save/delete, CSV/Notion export, and free-plan limits now work correctly with all stored data formats.
• If stored data is corrupted, the extension no longer stops working; it recovers safely.

[Performance]
• Lower CPU usage during ChatGPT streaming for better responsiveness.
```

---

**참고:** 크롬 웹스토어는 **새 패키지를 올릴 때마다 manifest의 version이 이전보다 커야** 합니다. 이번 업데이트는 `1.0.1`로 올려 두었습니다.
