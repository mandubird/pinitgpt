const LICENSE_STORAGE_KEY = "pinitgpt_license";
const LOCALE_STORAGE_KEY = "pinitgpt_locale";

var __popup_messages = {};
function t(k) { return __popup_messages[k] != null ? __popup_messages[k] : k; }

function getPopupLocale(cb) {
  try {
    chrome.storage.local.get([LOCALE_STORAGE_KEY], function (r) {
      var stored = r && r[LOCALE_STORAGE_KEY];
      if (stored && (stored === "en" || stored === "ko")) { cb(stored); return; }
      var nav = (typeof navigator !== "undefined" && navigator.language) ? navigator.language.toLowerCase() : "";
      cb(nav.indexOf("ko") === 0 ? "ko" : "en");
    });
  } catch (e) { cb("en"); }
}

function loadPopupLocale(cb) {
  getPopupLocale(function (lang) {
    var url = chrome.runtime.getURL("locales/" + lang + ".json");
    fetch(url).then(function (res) { return res.json(); }).catch(function () {
      return fetch(chrome.runtime.getURL("locales/en.json")).then(function (r) { return r.json(); });
    }).then(function (m) {
      __popup_messages = m || {};
      if (typeof cb === "function") cb();
    }).catch(function () { if (typeof cb === "function") cb(); });
  });
}

function applyPopupI18n() {
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    var key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    var key = el.getAttribute("data-i18n-html");
    if (key) el.innerHTML = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    var key = el.getAttribute("data-i18n-placeholder");
    if (key) el.placeholder = t(key);
  });
}

function parseLicense(stored) {
  if (!stored) return null;
  if (typeof stored === "string") return { type: "LTD", source: "gumroad", key: stored };
  if (stored.type) return stored;
  return null;
}
function isProLicense(license) {
  if (!license) return false;
  if (license.type === "LTD") return true;
  if (license.type === "SUB") {
    if (!license.expires_at) return true;
    return Date.now() < license.expires_at;
  }
  return false;
}

function showMsg(text, isError) {
  const el = document.getElementById("popup-msg");
  if (!el) return;
  el.textContent = text;
  el.className = "msg " + (isError ? "error" : "success");
}

function updateBadge(hasLicense) {
  const freeStatus = document.getElementById("free-status");
  const earlySection = document.getElementById("early-section");
  const licenseForm = document.getElementById("license-form");
  const buyLink = document.getElementById("popup-buy-link");
  if (freeStatus) freeStatus.style.display = hasLicense ? "none" : "block";
  if (earlySection) earlySection.style.display = hasLicense ? "block" : "none";
  if (licenseForm) licenseForm.style.display = hasLicense ? "none" : "block";
  if (buyLink) buyLink.style.display = hasLicense ? "none" : "block";
}

document.addEventListener("DOMContentLoaded", function () {
  loadPopupLocale(function () {
    applyPopupI18n();

    chrome.storage.local.get([LICENSE_STORAGE_KEY], function (r) {
      const license = parseLicense(r && r[LICENSE_STORAGE_KEY]);
      updateBadge(isProLicense(license));
    });

    document.getElementById("btn-activate").addEventListener("click", function () {
      const input = document.getElementById("license-in");
      const key = (input && input.value && input.value.trim()) || "";
      if (!key) {
        showMsg(t("popup_license_enter"), true);
        return;
      }
      showMsg(t("popup_verifying"), false);
      chrome.runtime.sendMessage({ action: "verifyLicense", key: key }, function (res) {
        if (chrome.runtime.lastError) {
          showMsg(t("popup_error_verify"), true);
          return;
        }
        if (!res || !res.verified) {
          showMsg(res && res.message ? res.message : t("popup_invalid_license"), true);
          return;
        }
        const license = { type: "LTD", source: "gumroad", key: key, verified: true };
        chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: license }, function () {
          updateBadge(true);
          var msgEl = document.getElementById("popup-msg");
          if (msgEl) {
            msgEl.className = "msg success";
            var usesText = (res && res.uses != null)
              ? "<br><span style=\"font-size:10px; color:#888;\">" + t("popup_devices_used").replace("{0}", String(res.uses)).replace("{1}", String(res.maxUses || 3)) + "</span>"
              : "";
            msgEl.innerHTML = t("popup_success_title") + "<br><br>" + t("popup_success_desc") + usesText;
          }
          if (input) input.value = "";
        });
      });
    });

    document.getElementById("btn-remove").addEventListener("click", function () {
      chrome.storage.local.remove(LICENSE_STORAGE_KEY, function () {
        updateBadge(false);
        showMsg(t("popup_pro_removed"));
      });
    });
  });
});
