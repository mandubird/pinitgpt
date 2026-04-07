const LICENSE_STORAGE_KEY = "pinitgpt_license";
const LOCALE_STORAGE_KEY = "pinitgpt_locale";
const GUMROAD_URL = "https://remoney.gumroad.com/l/pinitgpt";

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

function trackUpgrade(source) {
  try {
    if (typeof gtag !== "undefined") {
      gtag("event", "click_upgrade", { source: source });
      return;
    }
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "click_upgrade", source: source });
    }
  } catch (e) {}
}

function showPopupUpgradeModal(source) {
  if (document.getElementById("pinitgpt-popup-upgrade-modal")) return;
  const modal = document.createElement("div");
  modal.id = "pinitgpt-popup-upgrade-modal";
  Object.assign(modal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.6)",
    zIndex: "999999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  });
  modal.innerHTML = ''
    + '<div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:22px 18px;max-width:300px;width:92%;text-align:center;color:#fff;">'
    + '<div style="font-size:22px;margin-bottom:8px;">🔒</div>'
    + '<h3 style="margin:0 0 8px;font-size:16px;">This feature is available in Pro</h3>'
    + '<p style="margin:0 0 14px;font-size:12px;color:#aaa;line-height:1.5;">Unlock unlimited pins, search, tags, and export.</p>'
    + '<button id="pinitgpt-popup-upgrade-btn" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:10px 12px;font-size:13px;font-weight:600;cursor:pointer;width:100%;margin-bottom:8px;">Upgrade to Pro</button>'
    + '<button id="pinitgpt-popup-upgrade-close" style="background:transparent;color:#666;border:none;font-size:12px;cursor:pointer;">Later</button>'
    + '</div>';
  document.body.appendChild(modal);
  const upBtn = document.getElementById("pinitgpt-popup-upgrade-btn");
  const closeBtn = document.getElementById("pinitgpt-popup-upgrade-close");
  if (upBtn) upBtn.addEventListener("click", function () {
    trackUpgrade(source || "feature_lock");
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: GUMROAD_URL });
    else window.open(GUMROAD_URL, "_blank");
    modal.remove();
  });
  if (closeBtn) closeBtn.addEventListener("click", function () { modal.remove(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
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
      const hasPro = isProLicense(license);
      updateBadge(hasPro);
      const banner = document.getElementById("upgrade-banner");
      if (banner) banner.style.display = hasPro ? "none" : "block";
    });

    const featureLocks = ["search-lock", "tags-lock", "export-lock"];
    featureLocks.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", function () {
        chrome.storage.local.get([LICENSE_STORAGE_KEY], function (r) {
          const license = parseLicense(r && r[LICENSE_STORAGE_KEY]);
          if (!isProLicense(license)) {
            showPopupUpgradeModal("feature_lock");
          }
        });
      });
    });

    const bannerBtn = document.getElementById("banner-upgrade-btn");
    if (bannerBtn) {
      bannerBtn.addEventListener("click", function () {
        trackUpgrade("sidebar_banner");
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: GUMROAD_URL });
      });
    }

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
