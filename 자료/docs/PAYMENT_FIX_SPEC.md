# pinitgpt — 유료 결제 누락 기능 개발 명세서

> **대상 파일**: `background.js`, `popup.html`, `popup.js`, `content.js`, `locales/ko.json`, `locales/en.json`
> **목적**: 유료 결제(Gumroad 라이센스) 흐름에서 빠진 6가지 항목을 구현한다.

---

## 현재 구조 요약 (수정 전 기준)

| 파일 | 역할 |
|---|---|
| `background.js` | Gumroad API 라이센스 검증 서비스 워커 |
| `popup.html` / `popup.js` | 익스텐션 아이콘 클릭 시 열리는 팝업 (라이센스 활성화/해제 UI) |
| `content.js` | ChatGPT 페이지에 주입되는 메인 스크립트 (사이드바, 핀 관리, Pro 기능 잠금) |
| `locales/ko.json` / `en.json` | i18n 텍스트 (94개 키) |

### 라이센스 스토리지 구조

```js
// chrome.storage.local 키: "pinitgpt_license"
// Pro 사용자:
{
  type: "LTD",        // "LTD"(평생) 또는 "SUB"(구독, 미래 예정)
  source: "gumroad",
  key: "XXXX-XXXX-XXXX-XXXX",
  verified: true
}
// Free 사용자: 키 없음 (undefined)
```

### Pro 판별 함수 (현재)

```js
// popup.js & content.js 동일 로직
function parseLicense(stored) {
  if (!stored) return null;
  if (typeof stored === "string") return { type: "LTD", source: "gumroad", key: stored };
  if (stored.type) return stored;
  return null;
}
function isProLicense(license) {
  return license && (license.type === "LTD" || license.type === "SUB");
}
```

### Gumroad API

- **엔드포인트**: `POST https://api.gumroad.com/v2/licenses/verify`
- **파라미터**:
  - `product_id`: `"tEXDTnYWDXAPRxHHYdfIXQ=="`
  - `license_key`: 사용자 입력 키
  - `increment_uses_count`: `"true"` (활성화 시) / `"false"` (재검증 시)
- **응답**:
  ```json
  {
    "success": true,
    "uses": 2,
    "purchase": {
      "refunded": false,
      "chargebacked": false,
      "license_key": "..."
    }
  }
  ```
- **`MAX_USES_PER_KEY`**: `3` (키 1개당 최대 3기기)

---

## 구현 항목

---

### 항목 1: 라이센스 재검증 (환불/취소 감지)

**문제**: 라이센스를 1회 활성화하면 로컬에 영구 저장된다. Gumroad에서 환불/취소가 발생해도 Pro 상태가 유지된다.

**해결**: `background.js`에 `chrome.alarms`를 이용한 주기적 재검증 로직을 추가한다.

#### `background.js` 수정 사항

1. **알람 등록**: 설치/업데이트 시, 그리고 서비스 워커 시작 시 `"pinitgpt_revalidate"` 알람을 생성한다.
   주기: **24시간마다 1회** (`periodInMinutes: 1440`).

2. **`chrome.alarms.onAlarm` 리스너 추가**: 알람 발생 시 스토리지에서 라이센스를 읽어 Gumroad API에 재검증 요청을 보낸다.
   이 때 `increment_uses_count: "false"`를 사용하여 use count를 증가시키지 않는다.

3. **재검증 로직**:
   - `data.success === false` → 라이센스 무효. 스토리지에서 `pinitgpt_license` 삭제.
   - `data.purchase.refunded === true` 또는 `data.purchase.chargebacked === true` → 환불 처리됨. 스토리지에서 삭제.
   - 네트워크 오류 → 아무것도 하지 않는다 (오프라인 허용).
   - 재검증 성공 시 → 기존 라이센스 유지.

4. **`manifest.json` 수정**: `"alarms"` 권한 추가.
   ```json
   "permissions": ["storage", "alarms"]
   ```

5. **즉시 검증**: 서비스 워커 최초 실행(`chrome.runtime.onInstalled` 외부 최상위) 시에도 스토리지에 라이센스가 있으면 즉시 1회 재검증한다.

#### 구현 코드 위치

- `background.js` 전체 수정
- `manifest.json` — `"permissions"` 배열에 `"alarms"` 추가

---

### 항목 2: 사이드바 라이센스 섹션 — Pro 상태에 따른 조건부 표시

**문제**: `content.js`의 사이드바 하단에 라이센스 입력폼(`#pinitgpt-license-in`, `#pinitgpt-license-activate`)이 Pro 상태에서도 항상 표시된다.
`renderPins()` 함수 내에서 `#pinitgpt-early-badge`는 조건부로 숨기지만, 라이센스 입력 섹션 전체는 처리하지 않는다.

**해결**: `renderPins()` 함수 내 기존 `earlyBadgeEl` 처리 코드 바로 아래에 다음 로직을 추가한다.

#### `content.js` 수정 사항

`renderPins()` 내부 — `earlyBadgeEl.style.display = isProUser() ? "block" : "none";` 라인 다음에:

```js
// 라이센스 입력 섹션: Pro면 숨기고, Free면 보인다
var licenseSection = document.getElementById("pinitgpt-license-section");
if (licenseSection) {
  licenseSection.style.display = isProUser() ? "none" : "block";
}
```

#### 사이드바 HTML 수정

현재 `content.js` 내 사이드바 HTML 생성 코드 (라인 388~392):

```html
<!-- 현재: div에 id가 없음 -->
<div style="margin-top:12px; padding-top:10px; border-top:1px solid #222;">
  <input type="text" id="pinitgpt-license-in" ...>
  <button id="pinitgpt-license-activate" ...>...</button>
  <div id="pinitgpt-license-msg" ...></div>
</div>
```

→ 감싸는 `div`에 `id="pinitgpt-license-section"` 추가:

```html
<div id="pinitgpt-license-section" style="margin-top:12px; padding-top:10px; border-top:1px solid #222;">
  <input type="text" id="pinitgpt-license-in" ...>
  <button id="pinitgpt-license-activate" ...>...</button>
  <div id="pinitgpt-license-msg" ...></div>
</div>
```

---

### 항목 3: 사이드바 Pro 비활성화 버튼 추가

**문제**: popup에는 `btn-remove`(Pro 해제) 버튼이 있지만, 사이드바에는 없다.
사용자가 기기를 교체하거나 재설치할 때 사이드바에서도 비활성화할 수 있어야 한다.

**해결**: `pinitgpt-early-badge-wrap` 내부에 비활성화 버튼을 추가한다. Pro 상태일 때만 표시한다.

#### `content.js` 사이드바 HTML 수정

현재 `#pinitgpt-early-badge-wrap` 내부 (라인 385~387):

```html
<div id="pinitgpt-early-badge-wrap" style="margin-top:12px; padding-top:10px; border-top:1px solid #222;">
  <div id="pinitgpt-early-badge" style="display:none; ...">
    <span>...</span>
    <div id="pinitgpt-early-tooltip" ...></div>
  </div>
</div>
```

→ `pinitgpt-early-badge` div 아래에 비활성화 버튼 추가:

```html
<div id="pinitgpt-early-badge-wrap" style="margin-top:12px; padding-top:10px; border-top:1px solid #222;">
  <div id="pinitgpt-early-badge" style="display:none; ...">
    <span>...</span>
    <div id="pinitgpt-early-tooltip" ...></div>
  </div>
  <button id="pinitgpt-license-remove" style="display:none; margin-top:8px; width:100%; padding:7px; background:transparent; border:1px solid #444; color:#666; border-radius:6px; cursor:pointer; font-size:11px;">
    Pro 해제
  </button>
</div>
```

#### `content.js` 이벤트 핸들러 추가

`setupSidebar()` 함수 내 기존 `licenseActivate` 이벤트 핸들러 아래에 추가:

```js
var licenseRemoveBtn = sidebar.querySelector("#pinitgpt-license-remove");
if (licenseRemoveBtn) {
  licenseRemoveBtn.addEventListener("click", function() {
    chrome.storage.local.remove(LICENSE_STORAGE_KEY, function() {
      user.isPro = false;
      filterMode = "current";
      if (typeof renderPins === "function") renderPins();
    });
  });
}
```

#### `renderPins()` 수정

`earlyBadgeEl` 처리 코드 아래에 비활성화 버튼 표시/숨김 로직 추가:

```js
var licenseRemoveBtnEl = document.getElementById("pinitgpt-license-remove");
if (licenseRemoveBtnEl) {
  licenseRemoveBtnEl.style.display = isProUser() ? "block" : "none";
}
```

#### i18n 텍스트 적용

비활성화 버튼 텍스트에 `t("license_remove_btn")` 적용 (항목 6 i18n 추가 참조).

---

### 항목 4: popup.html — Pro 상태에서 구매 링크 숨기기

**문제**: `popup.html` 하단의 구매 링크 `<a>` 태그가 Pro 상태에서도 항상 표시된다.
`updateBadge(hasLicense)` 함수가 `free-status`, `early-section`, `license-form`만 조건부로 처리하고 구매 링크를 처리하지 않는다.

**해결**:

#### `popup.html` 수정

구매 링크 `<a>` 태그에 `id="popup-buy-link"` 추가:

```html
<a id="popup-buy-link" href="https://remoney.gumroad.com/l/pinitgpt" target="_blank" rel="noopener" style="display:block; margin-top:10px; ..." data-i18n="popup_buy_link">
  🔓 Early Supporter 구매 ($4.99)
</a>
```

#### `popup.js` 수정

`updateBadge(hasLicense)` 함수에 구매 링크 처리 추가:

```js
function updateBadge(hasLicense) {
  const freeStatus = document.getElementById("free-status");
  const earlySection = document.getElementById("early-section");
  const licenseForm = document.getElementById("license-form");
  const buyLink = document.getElementById("popup-buy-link");   // 추가
  if (freeStatus) freeStatus.style.display = hasLicense ? "none" : "block";
  if (earlySection) earlySection.style.display = hasLicense ? "block" : "none";
  if (licenseForm) licenseForm.style.display = hasLicense ? "none" : "block";
  if (buyLink) buyLink.style.display = hasLicense ? "none" : "block";  // 추가
}
```

---

### 항목 5: 활성화 성공 시 기기 수 피드백 표시

**문제**: `background.js`에서 `data.uses`를 읽어 초과 여부만 판단하지만, 활성화 성공 시 "현재 X/3 기기에서 사용 중" 정보를 사용자에게 전달하지 않는다.

**해결**: `background.js`의 응답에 `uses` 필드를 추가하고, 팝업과 사이드바 활성화 성공 메시지에 기기 수를 표시한다.

#### `background.js` 수정

성공 응답에 `uses` 추가:

```js
// 기존:
sendResponse({ verified: true });

// 변경:
sendResponse({ verified: true, uses: uses, maxUses: MAX_USES_PER_KEY });
```

#### `popup.js` 수정

활성화 성공 콜백에서 기기 수 표시:

```js
// 기존 성공 처리 코드:
chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: license }, function () {
  updateBadge(true);
  var msgEl = document.getElementById("popup-msg");
  if (msgEl) {
    msgEl.className = "msg success";
    msgEl.innerHTML = t("popup_success_title") + "<br><br>" + t("popup_success_desc");
  }
  if (input) input.value = "";
});

// 변경: res.uses를 메시지에 포함
chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: license }, function () {
  updateBadge(true);
  var msgEl = document.getElementById("popup-msg");
  if (msgEl) {
    msgEl.className = "msg success";
    var usesText = (res.uses != null)
      ? "<br><span style=\"font-size:10px; color:#888;\">" + t("popup_devices_used").replace("{0}", String(res.uses)).replace("{1}", String(res.maxUses || 3)) + "</span>"
      : "";
    msgEl.innerHTML = t("popup_success_title") + "<br><br>" + t("popup_success_desc") + usesText;
  }
  if (input) input.value = "";
});
```

#### `content.js` 수정 (사이드바 활성화 성공 메시지)

`chrome.runtime.sendMessage` 콜백 성공 처리에서:

```js
// 활성화 성공 직후 licenseMsg에 기기 수 표시
if (licenseMsg && res.uses != null) {
  licenseMsg.style.display = "block";
  licenseMsg.style.color = "#888";
  licenseMsg.textContent = t("license_devices_used").replace("{0}", String(res.uses)).replace("{1}", String(res.maxUses || 3));
}
```

---

### 항목 6: SUB 타입 만료일 검증 추가 (향후 구독 대비)

**문제**: `isProLicense()`에서 `type === "SUB"`를 Pro로 인정하지만, 만료일 검증 로직이 없다.
향후 구독 모델 전환 시 만료된 구독도 Pro로 계속 인식될 위험이 있다.

**해결**: `isProLicense()`에 SUB 타입에 대한 만료일 검증을 추가한다. (LTD는 영향 없음)

#### `popup.js` 및 `content.js` 동일 적용

두 파일의 `isProLicense()` 함수를 동일하게 수정:

```js
function isProLicense(license) {
  if (!license) return false;
  if (license.type === "LTD") return true;
  if (license.type === "SUB") {
    // expires_at이 없으면 Pro로 인정 (데이터 없는 구 버전 호환)
    if (!license.expires_at) return true;
    // expires_at이 있으면 현재 시각과 비교
    return Date.now() < license.expires_at;
  }
  return false;
}
```

- `expires_at`: Unix timestamp (ms). 구독 검증 API에서 받은 값을 저장.
- LTD 타입은 기존과 동일하게 항상 true.

---

### 항목 7 (추가 발견): 라이센스 키 복구 안내 추가

**문제**: 활성화 후 input이 clear(`input.value = ""`)되고, Pro 팝업 화면에서 라이센스 키를 확인할 방법이 없다.
다른 기기에서 활성화하려면 Gumroad 이메일에서 직접 찾아야 하는데 안내가 없다.

**해결**: Pro 활성화 화면(`early-section`)에 Gumroad 라이센스 확인 링크를 추가한다.

#### `popup.html` 수정

`early-section` div 내 `btn-remove` 버튼 위에 링크 추가:

```html
<a href="https://app.gumroad.com/library" target="_blank" rel="noopener"
   style="display:block; margin-bottom:8px; font-size:10px; color:#888; text-align:center; text-decoration:underline;"
   data-i18n="popup_find_license_key">
  라이센스 키 확인 (Gumroad)
</a>
```

---

## i18n 추가 키 목록

다음 키를 `locales/ko.json`과 `locales/en.json` 양쪽에 추가한다.

### `locales/ko.json` 추가

```json
"popup_devices_used": "현재 {0}/{1} 기기에서 사용 중",
"license_devices_used": "현재 {0}/{1} 기기에서 사용 중",
"license_remove_btn": "Pro 해제",
"popup_find_license_key": "라이센스 키 확인 (Gumroad 라이브러리)",
"popup_revalidate_fail": "라이센스가 만료 또는 취소되었습니다. Pro가 해제되었습니다."
```

### `locales/en.json` 추가

```json
"popup_devices_used": "Using on {0} of {1} devices",
"license_devices_used": "Using on {0} of {1} devices",
"license_remove_btn": "Deactivate Pro",
"popup_find_license_key": "Find license key (Gumroad Library)",
"popup_revalidate_fail": "License expired or revoked. Pro has been deactivated."
```

---

## 수정 파일 체크리스트

| 파일 | 수정 내용 |
|---|---|
| `manifest.json` | `"permissions"`에 `"alarms"` 추가 |
| `background.js` | 재검증 알람 로직, 응답에 `uses` 필드 추가 |
| `popup.html` | 구매 링크에 `id` 추가, Early Supporter 섹션에 Gumroad 링크 추가 |
| `popup.js` | `updateBadge()` 구매 링크 처리, 기기 수 표시, `isProLicense()` SUB 만료일 검증 |
| `content.js` | 사이드바 라이센스 섹션 div에 id 추가, `renderPins()` Pro 상태 처리, 비활성화 버튼 추가, `isProLicense()` SUB 만료일 검증 |
| `locales/ko.json` | 5개 키 추가 |
| `locales/en.json` | 5개 키 추가 |

---

## 구현 시 주의사항

1. **재검증 API 호출은 `increment_uses_count: "false"`** 로 고정한다. `"true"`로 잘못 호출하면 use count가 불필요하게 증가한다.

2. **네트워크 오류 시 라이센스 삭제 금지**. 재검증 실패는 오프라인 상황일 수 있으므로 `catch` 블록에서 아무것도 하지 않는다.

3. **`content.js`와 `popup.js`의 `isProLicense()` 함수는 동일 로직**이어야 한다. 두 파일 모두 수정한다.

4. **사이드바 HTML은 `content.js` 내 문자열 템플릿으로 생성**된다. 백틱 템플릿 리터럴 내부의 HTML을 수정할 때 이스케이프(`\"`, `\'`)에 주의한다.

5. **`chrome.alarms` API는 Manifest V3 서비스 워커에서만 동작**한다. `background.js`는 이미 서비스 워커이므로 문제없다.

6. **알람 중복 생성 방지**: `chrome.alarms.create` 전에 `chrome.alarms.get("pinitgpt_revalidate", cb)`로 존재 여부를 확인하거나, `chrome.alarms.clear` 후 재생성한다.
