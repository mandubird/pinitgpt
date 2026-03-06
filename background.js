const GUMROAD_PRODUCT_ID = "tEXDTnYWDXAPRxHHYdfIXQ==";
const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";
const MAX_USES_PER_KEY = 3;
const LICENSE_STORAGE_KEY = "pinitgpt_license";
const REVALIDATE_ALARM_NAME = "pinitgpt_revalidate";

function verifyWithGumroad(key, incrementUses) {
  var body = new URLSearchParams();
  body.append("product_id", GUMROAD_PRODUCT_ID);
  body.append("license_key", key);
  body.append("increment_uses_count", incrementUses ? "true" : "false");
  return fetch(GUMROAD_VERIFY_URL, {
    method: "POST",
    body: body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  }).then(function (res) { return res.json(); });
}

function revalidateStoredLicense() {
  chrome.storage.local.get([LICENSE_STORAGE_KEY], function (r) {
    var stored = r && r[LICENSE_STORAGE_KEY];
    if (!stored) return;
    var key = typeof stored === "string" ? stored : (stored.key || "");
    if (!key) return;
    verifyWithGumroad(key, false).then(function (data) {
      if (!data) return;
      if (data.success === false) {
        chrome.storage.local.remove(LICENSE_STORAGE_KEY);
        return;
      }
      var purchase = data.purchase;
      if (purchase && (purchase.refunded === true || purchase.chargebacked === true)) {
        chrome.storage.local.remove(LICENSE_STORAGE_KEY);
        return;
      }
    }).catch(function () {});
  });
}

function ensureRevalidateAlarm() {
  chrome.alarms.clear(REVALIDATE_ALARM_NAME, function () {
    chrome.alarms.create(REVALIDATE_ALARM_NAME, { periodInMinutes: 1440 });
  });
}

chrome.runtime.onInstalled.addListener(function () {
  ensureRevalidateAlarm();
  revalidateStoredLicense();
});

chrome.runtime.onStartup.addListener(function () {
  ensureRevalidateAlarm();
  revalidateStoredLicense();
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm && alarm.name === REVALIDATE_ALARM_NAME) {
    revalidateStoredLicense();
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action !== "verifyLicense") {
    sendResponse({ verified: false, message: "Unknown action" });
    return true;
  }
  var key = (request.key && request.key.trim()) || "";
  if (!key) {
    sendResponse({ verified: false, message: "라이센스 키를 입력해 주세요." });
    return true;
  }
  verifyWithGumroad(key, true)
    .then(function (data) {
      if (data && data.success === true) {
        var uses = data.uses != null ? parseInt(data.uses, 10) : 0;
        if (uses > MAX_USES_PER_KEY) {
          sendResponse({ verified: false, message: "사용 횟수 제한(" + MAX_USES_PER_KEY + "회)을 초과했습니다. 이 키는 더 이상 활성화할 수 없습니다." });
        } else {
          sendResponse({ verified: true, uses: uses, maxUses: MAX_USES_PER_KEY });
        }
      } else {
        var msg = (data && data.message) ? data.message : "유효하지 않은 라이센스 키입니다.";
        sendResponse({ verified: false, message: msg });
      }
    })
    .catch(function (err) {
      sendResponse({ verified: false, message: "검증 요청에 실패했습니다. 네트워크를 확인해 주세요." });
    });
  return true;
});
