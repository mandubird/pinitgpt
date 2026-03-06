# pinitgpt 라이선스 전략

## 지금 단계: Early MVP / 서버 최소화

### Gumroad License Key 발급
- Gumroad에서 상품별 Unique License Key 발급
- 구매 완료 시 키 노출 (Receipt / 이메일)

### Extension에서 직접 `licenses/verify` 호출
- 백그라운드(background.js)에서 `POST https://api.gumroad.com/v2/licenses/verify` 호출
- `product_id` + `license_key` 전달

### `increment_uses_count = true` 사용
- 검증 요청 시 Gumroad가 해당 키의 **사용 횟수(uses)** 를 1 증가
- 응답에 `uses` 값 포함

### 키당 2~3회까지만 허용, 초과 시 무효 처리
- **MAX_USES_PER_KEY = 3** (기기 제한처럼 활용)
- 검증 성공(`success: true`)이어도 **`uses > 3`이면 활성화 거부**
- 사용자에게: "사용 횟수 제한(3회)을 초과했습니다. 이 키는 더 이상 활성화할 수 없습니다."

### 흐름
```
사용자 입력한 license key
      ↓
Gumroad API verify 호출 (increment_uses_count=true)
      ↓
uses_count 자동 증가
      ↓
uses > 3 → 실패 처리 (저장 안 함)
uses ≤ 3 → Pro 활성화, storage 저장
```

- **서버 없음**: Extension ↔ Gumroad API 직접 통신만 사용

---

## 이후 단계: 월 구독 전환 시점

### Cloudflare Worker 도입
- 라이선스 검증 / 기기 제한을 Worker에서 처리

### Device hash 저장
- 브라우저/기기 식별용 해시 저장
- **진짜 2기기 제한** 구현

### Cloud sync 포함
- Pro 기능으로 클라우드 동기화 제공 시, Worker에서 계정·기기 수 관리

---

*이 문서는 Early Supporter LTD와 월 구독 전환 시 라이선스/기기 정책 방향을 정리한 것입니다.*
