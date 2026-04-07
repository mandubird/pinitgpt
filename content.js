/***********************
 * pinitgpt – content.js
 * STEP 32.1 (Pro Feature Flag + UX Lock)
 ***********************/

const STORAGE_KEY = "pinitgpt_pins";
const PIN_GUIDE_SEEN_KEY = "pinitgpt_pin_guide_seen";
const FIRST_GUIDE_SEEN_KEY = "pinitgpt_first_guide_seen";
const CATEGORY_NAMES_KEY = "pinitgpt_category_names";
const PENDING_SCROLL_KEY = "pinitgpt_pending_scroll";
const PENDING_TAG_KEY = "pinitgpt_pending_tag";
let currentFilter = "all";
let currentTagFilter = null;
let filterMode = "current"; // "all" | "current" | "continue" — Free 기본 current, Pro 기본 all
let sortMode = "latest";    // "latest" | "oldest"
let searchQuery = "";
let categoryCollapsed = false;

// =====================
// Feature Flag (Pro / Free)
const FEATURES = {
  STAR: true,
  TAG_UNLIMITED: true,
  PIN_LIMIT: 20
};

const LIMITS = {
  FREE: { PROJECTS: 1, PINS_PER_PROJECT: 5 },
  PRO: { PROJECTS: Infinity, PINS_PER_PROJECT: Infinity }
};

// 임시 사용자 정보 (나중에 서버 연동 가능)
const user = { isPro: false };

const LICENSE_STORAGE_KEY = "pinitgpt_license";
const LOCALE_STORAGE_KEY = "pinitgpt_locale";
const GUMROAD_URL = "https://remoney.gumroad.com/l/pinitgpt";
const UPGRADE_PROMPT_TS_KEY = "pinitgpt_upgrade_prompt_last_ts";
const UPGRADE_PROMPT_COOLDOWN_MS = 10 * 60 * 1000; // 10분

function nowTs() {
  return Date.now ? Date.now() : new Date().getTime();
}

function shouldShowUpgradePrompt() {
  try {
    const raw = localStorage.getItem(UPGRADE_PROMPT_TS_KEY);
    if (!raw) return true;
    const last = parseInt(raw, 10) || 0;
    return (nowTs() - last) >= UPGRADE_PROMPT_COOLDOWN_MS;
  } catch (e) {
    return true;
  }
}

function markUpgradePromptShown() {
  try {
    localStorage.setItem(UPGRADE_PROMPT_TS_KEY, String(nowTs()));
  } catch (e) {}
}

function trackUpgradeClick(source) {
  try {
    console.debug("pinitgpt click_upgrade", { source: source });
  } catch (e) {}
}

function openGumroadFromExtension(source) {
  trackUpgradeClick(source);
  try {
    window.open(GUMROAD_URL, "_blank", "noopener");
  } catch (e) {}
}

// 블록 단위 Pin: 렌더 블록(p, li, h1~h4, pre, blockquote) 기준
const BLOCK_TAG_SELECTOR = "p, li, h1, h2, h3, h4, pre, blockquote";
const BLOCK_TEXT_HEAD_LEN = 30;

function getMessageContentRoot(msg) {
  if (!msg || !msg.querySelector) return msg;
  var root = msg.querySelector("[class*='markdown']") || msg.querySelector("[class*='prose']") || msg.querySelector("[class*='message']");
  return root || msg;
}

function getBlocksInMessage(msg) {
  var root = getMessageContentRoot(msg);
  var all = root.querySelectorAll(BLOCK_TAG_SELECTOR);
  var list = Array.prototype.slice.call(all);
  var topLevel = list.filter(function (el) {
    var p = el.parentElement;
    while (p && p !== root) {
      if (list.indexOf(p) !== -1) return false;
      p = p.parentElement;
    }
    return true;
  });
  topLevel.sort(function (a, b) {
    return (a.compareDocumentPosition(b) & 2) ? 1 : -1;
  });
  return topLevel;
}

function getBlockType(el) {
  if (!el || !el.tagName) return "paragraph";
  var tag = el.tagName.toLowerCase();
  if (tag === "li") return "list_item";
  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") return "heading";
  if (tag === "pre") return "code";
  if (tag === "blockquote") return "blockquote";
  return "paragraph";
}

function getBlockTextHead(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim().slice(0, BLOCK_TEXT_HEAD_LEN);
}

// i18n: default English, detect ko from navigator.language; manual override via LOCALE_STORAGE_KEY
var __pinitgpt_messages = {};
var __pinitgpt_current_locale = "en";
function t(k) { return __pinitgpt_messages[k] != null ? __pinitgpt_messages[k] : k; }
function getLocale(cb) {
  try {
    chrome.storage.local.get([LOCALE_STORAGE_KEY], function (r) {
      var stored = r && r[LOCALE_STORAGE_KEY];
      if (stored && (stored === "en" || stored === "ko")) { cb(stored); return; }
      var nav = (typeof navigator !== "undefined" && navigator.language) ? navigator.language.toLowerCase() : "";
      cb(nav.indexOf("ko") === 0 ? "ko" : "en");
    });
  } catch (e) { cb("en"); }
}
function loadLocale(cb) {
  getLocale(function (lang) {
    var url = chrome.runtime.getURL("locales/" + lang + ".json");
    fetch(url).then(function (res) { return res.json(); }).catch(function () {
      return fetch(chrome.runtime.getURL("locales/en.json")).then(function (r) { return r.json(); });
    }).then(function (m) {
      __pinitgpt_messages = m || {};
      __pinitgpt_current_locale = lang;
      if (typeof cb === "function") cb();
    }).catch(function () { if (typeof cb === "function") cb(); });
  });
}
function setLocaleAndRefresh(lang, done) {
  if (lang !== "en" && lang !== "ko") return;
  try {
    chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: lang }, function () {
      var url = chrome.runtime.getURL("locales/" + lang + ".json");
      fetch(url).then(function (res) { return res.json(); }).then(function (m) {
        __pinitgpt_messages = m || {};
        __pinitgpt_current_locale = lang;
        if (typeof refreshSidebarI18n === "function") refreshSidebarI18n();
        if (typeof renderPins === "function") renderPins();
        if (typeof done === "function") done();
      }).catch(function () { if (typeof done === "function") done(); });
    });
  } catch (e) { if (typeof done === "function") done(); }
}

// License: { type: 'FREE'|'LTD'|'SUB', source?: 'gumroad'|'stripe', key?: string }
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

function isProUser() { return !!user.isPro; }

function loadProState() {
  try {
    chrome.storage.local.get([LICENSE_STORAGE_KEY], function (r) {
      var license = parseLicense(r && r[LICENSE_STORAGE_KEY]);
      user.isPro = isProLicense(license);
      if (user.isPro) filterMode = "all";
      else filterMode = "current";
      if (typeof renderPins === "function") renderPins();
    });
  } catch (e) { user.isPro = false; filterMode = "current"; }
}
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === "local" && changes[LICENSE_STORAGE_KEY]) {
      var license = parseLicense(changes[LICENSE_STORAGE_KEY].newValue);
      user.isPro = isProLicense(license);
      if (user.isPro) filterMode = "all";
      else filterMode = "current";
      if (typeof renderPins === "function") renderPins();
    }
  });
}

function isPro(feature) { 
  return user.isPro && FEATURES[feature]; 
}

// =====================
function getChatId() {
  const match = location.pathname.match(/\/c\/([^/]+)/);
  return match ? match[1] : "unknown";
}
let CHAT_ID = getChatId();
let lastChatId = CHAT_ID;

// 현재 채팅 제목: 좌측 사이드바의 "현재 채팅" 링크 텍스트를 우선 사용. 페이지 본문의 h1은 채팅 내용과 혼동되므로 폴백만 사용.
function getCurrentChatTitle() {
  try {
    var id = String(CHAT_ID || "").trim();
    if (id && id !== "unknown") {
      var links = document.querySelectorAll("a[href*='/c/']");
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var href = (a.getAttribute("href") || a.href || "");
        if (href.indexOf("/c/" + id) === -1 && href.indexOf("/c/" + id + "?") === -1) continue;
        var text = (a.textContent || "").trim();
        if (text.length > 0 && text.length < 120 && !/^[a-f0-9]{8,}$/i.test(text)) return text;
      }
    }
    var fallback = document.querySelector("[data-conversation-title]") || document.querySelector("nav a[href*='/c/']");
    if (fallback) {
      var txt = (fallback.textContent || "").trim();
      if (txt.length > 0 && txt.length < 120) return txt;
    }
    var h1 = document.querySelector("h1");
    if (h1) {
      var h1txt = (h1.textContent || "").trim();
      if (h1txt.length > 0 && h1txt.length < 120) return h1txt;
    }
  } catch (e) {}
  return t("chat");
}

// 좌측 채팅 목록에서 대화 제목 가져오기 (전체 보기 시 "채팅 69908c35" 대신 "글쓰기" 등 표시용)
function getConversationTitleFromPage(conversationId) {
  if (!conversationId) return "";
  try {
    var id = String(conversationId).trim();
    var links = document.querySelectorAll("a[href*='/c/']");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute("href") || a.href || "";
      if (href.indexOf("/c/" + id) === -1 && href.indexOf("/c/" + id + "?") === -1) continue;
      var text = (a.textContent || "").trim();
      if (text.length > 0 && text.length < 120 && !/^[a-f0-9]{8,}$/i.test(text)) return text;
    }
    for (var j = 0; j < links.length; j++) {
      var b = links[j];
      var h = b.getAttribute("href") || b.href || "";
      if (h.indexOf("/c/" + id) !== -1) {
        var txt = (b.textContent || "").trim();
        if (txt.length > 0 && txt.length < 120) return txt;
      }
    }
  } catch (e) {}
  return "";
}

function getPins() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function savePins(pins) { localStorage.setItem(STORAGE_KEY, JSON.stringify(pins)); }

// tags가 문자열/배열/기타일 때 안전하게 문자열 배열로 반환 (예전 데이터 호환)
function parseTags(tags) {
  if (tags == null || tags === "") return [];
  if (typeof tags === "string") return tags.split(",").map(function(t) { return t.trim(); }).filter(Boolean);
  if (Array.isArray(tags)) return tags.map(function(t) { return String(t).trim(); }).filter(Boolean);
  return [];
}

// 명세 Pin 구조 호환: conversationId, title, content, category, isContinue, chatTitle
function normalizePin(p) {
  var convId = p.conversationId != null ? p.conversationId : (p.chatId || "unknown");
  var chatTitle = p.chatTitle != null ? p.chatTitle : (t("chat_id_fallback").replace("{id}", String(convId).slice(0, 8)));
  return {
    ...p,
    conversationId: convId,
    chatTitle: chatTitle,
    title: p.title != null ? p.title : (p.label || (p.text ? p.text.slice(0, 50) : "")),
    content: p.content != null ? p.content : (p.text || ""),
    category: p.category != null ? p.category : (p.color || ""),
    isContinue: p.isContinue != null ? p.isContinue : (p.type === "continue")
  };
}
function getCurrentConversationId() { return getChatId(); }

var pinitgptLoadingOverlayTimeout8 = null;
var pinitgptLoadingOverlayTimeout30 = null;
function showLoadingOverlay() {
  if (document.getElementById("pinitgpt-loading-overlay")) return;
  var overlay = document.createElement("div");
  overlay.id = "pinitgpt-loading-overlay";
  overlay.innerHTML = "<div style=\"display:flex; flex-direction:column; align-items:center; gap:16px;\"><div style=\"width:40px; height:40px; border:3px solid #333; border-top-color:#00e5ff; border-radius:50%; animation: pinitgpt-spin 0.8s linear infinite;\"></div><div id=\"pinitgpt-loading-text\" style=\"color:#fff; font-size:14px;\">" + t("loading_navigating") + "</div></div>";
  Object.assign(overlay.style, {
    position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
    background: "rgba(0,0,0,0.75)", zIndex: "2147483646",
    display: "flex", alignItems: "center", justifyContent: "center",
    pointerEvents: "auto"
  });
  var style = document.createElement("style");
  style.textContent = "@keyframes pinitgpt-spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  pinitgptLoadingOverlayTimeout8 = setTimeout(function () {
    var el = document.getElementById("pinitgpt-loading-text");
    if (el) el.innerHTML = t("loading_navigating") + "<br><span style=\"font-size:12px; color:#aaa; margin-top:8px; display:block;\">" + t("loading_long").replace(/<br>/g, "<br>") + "</span>";
  }, 8000);
  pinitgptLoadingOverlayTimeout30 = setTimeout(function () {
    removeLoadingOverlay();
  }, 30000);
}
function removeLoadingOverlay() {
  if (pinitgptLoadingOverlayTimeout8) { clearTimeout(pinitgptLoadingOverlayTimeout8); pinitgptLoadingOverlayTimeout8 = null; }
  if (pinitgptLoadingOverlayTimeout30) { clearTimeout(pinitgptLoadingOverlayTimeout30); pinitgptLoadingOverlayTimeout30 = null; }
  var el = document.getElementById("pinitgpt-loading-overlay");
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function getDefaultCategoryNames() {
  return { starred: t("cat_starred"), red: t("cat_red"), blue: t("cat_blue"), green: t("cat_green"), gold: t("cat_gold"), continue: t("modal_opt_continue") };
}
function getCategoryNames() {
  try {
    const s = localStorage.getItem(CATEGORY_NAMES_KEY);
    const defaults = getDefaultCategoryNames();
    if (!s) return Object.assign({}, defaults);
    const o = JSON.parse(s);
    return Object.assign({}, defaults, o);
  } catch (e) { return Object.assign({}, getDefaultCategoryNames()); }
}
function saveCategoryName(key, label) {
  const o = getCategoryNames();
  o[key] = label;
  localStorage.setItem(CATEGORY_NAMES_KEY, JSON.stringify(o));
}

/* =====================
   Sidebar UI
===================== */
function createSidebar() {
  if (document.getElementById("pinitgpt-sidebar")) return;
  const sidebar = document.createElement("div");
  sidebar.id = "pinitgpt-sidebar";
  Object.assign(sidebar.style, {
    position: "fixed", top: "0", right: "0", width: "300px", height: "100vh",
    background: "#111", color: "#fff", zIndex: "2147483640", 
    padding: "14px 12px", 
    overflowY: "auto", fontSize: "14px", borderLeft: "1px solid #333", boxSizing: "border-box",
    display: "flex", flexDirection: "column"
  });

  sidebar.innerHTML = `
    <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <h3 style="margin:0 0 10px 0; font-size: 18px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:20px;">📌</span> PinitGPT
          <span id="pinitgpt-plan-badge" style="margin-left:auto; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold;">` + t("plan_free") + `</span>
        </h3>
        <div id="pinitgpt-usage-gauge" style="margin-bottom:10px; font-size:11px; color:#888;">
          <div id="pinitgpt-gauge-text" style="margin-bottom:4px;">` + t("pin_gauge").replace("{0}", "0").replace("{1}", "5") + `</div>
          <div style="height:5px; background:#222; border-radius:3px; overflow:hidden;"><div id="pinitgpt-gauge-bar" style="height:100%; width:0%; background:#00e5ff; border-radius:3px; transition:width 0.3s;"></div></div>
        </div>
        <div id="pinitgpt-free-notice" style="display:none; margin-bottom:10px; padding:10px; background:#1a1a2e; border:1px solid #333; border-radius:6px; font-size:12px; color:#00e5ff; line-height:1.4;"></div>
        <div id="pinitgpt-search-row" style="margin-bottom:10px; display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
          <span id="pinitgpt-search-label" style="font-size:11px; color:#888; white-space:nowrap; flex-shrink:0;">` + t("search") + `</span>
          <div style="flex:1; min-width:0; position:relative; display:flex; align-items:center;">
            <input type="text" id="pinitgpt-search-in" placeholder="` + t("search_placeholder") + `" style="width:100%; padding:6px 24px 6px 8px; border-radius:6px; border:1px solid #333; background:#222; color:#fff; font-size:11px; outline:none; box-sizing:border-box;">
            <span id="pinitgpt-search-clear" title="` + t("search_clear_title") + `" style="display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); width:18px; height:18px; border-radius:50%; background:#444; color:#fff; font-size:14px; line-height:18px; text-align:center; cursor:pointer; font-weight:bold;">×</span>
          </div>
          <select id="pinitgpt-sort-select" style="padding:6px 8px; border-radius:6px; border:1px solid #333; background:#222; color:#fff; font-size:11px; cursor:pointer; outline:none; flex-shrink:0;">
            <option value="latest">` + t("sort_latest") + `</option>
            <option value="oldest">` + t("sort_oldest") + `</option>
          </select>
        </div>
        <div id="pinitgpt-view-row" style="margin-bottom:10px;">
          <div id="pinitgpt-view-label" style="font-size:12px; color:#888; margin-bottom:6px;">` + t("view_label") + `</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <button data-view="all" class="view-btn view-btn-pro" data-tooltip="` + t("view_all_tooltip_lock") + `" data-pro-tooltip="` + t("view_all_tooltip_pro") + `">` + t("view_all") + `</button>
            <button data-view="current" class="view-btn active" data-tooltip="` + t("view_current_tooltip") + `">` + t("view_current") + `</button>
            <button data-view="continue" class="view-btn view-btn-pro" data-tooltip="` + t("view_continue_tooltip_lock") + `" data-pro-tooltip="` + t("view_continue_tooltip_pro") + `">` + t("view_continue") + `</button>
          </div>
        </div>
        <div id="pinitgpt-category-section" style="margin-bottom:10px;">
          <div id="pinitgpt-category-toggle" style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; color:#ccc; padding:4px 0;">
            <span id="pinitgpt-category-arrow">▾</span>
            <span>` + t("category_label") + `</span>
          </div>
          <div id="pinitgpt-category-list" style="margin-left:4px; margin-top:4px;">
            <div class="category-row" data-filter="all" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("category_all") + `</span><span class="category-edit" style="display:none;"></span></div>
            <div class="category-row" data-filter="starred" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("cat_starred") + `</span><span class="category-edit" style="opacity:0; font-size:11px;">✏️</span></div>
            <div class="category-row" data-filter="red" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("cat_red") + `</span><span class="category-edit" style="opacity:0; font-size:11px;">✏️</span></div>
            <div class="category-row" data-filter="blue" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("cat_blue") + `</span><span class="category-edit" style="opacity:0; font-size:11px;">✏️</span></div>
            <div class="category-row" data-filter="green" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("cat_green") + `</span><span class="category-edit" style="opacity:0; font-size:11px;">✏️</span></div>
            <div class="category-row" data-filter="gold" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("cat_gold") + `</span><span class="category-edit" style="opacity:0; font-size:11px;">✏️</span></div>
            <div class="category-row" data-filter="continue" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;"><span class="category-label">` + t("modal_opt_continue") + `</span><span class="category-edit" style="display:none;"></span></div>
          </div>
        </div>
        <div id="pinitgpt-filter-tooltip" style="display:none; position:fixed; padding:5px 8px; background:#0a0a0a; color:#ccc; border:1px solid #333; border-radius:6px; font-size:10px; z-index:2147483642; pointer-events:none; max-width:160px;"></div>
        <div id="active-tag-area" style="margin-bottom:10px; display:none; background:#222; padding:8px; border-radius:6px; border:1px solid #333;">
            <span id="tag-label" style="color:#00e5ff; font-size:12px; font-weight:bold;"></span>
            <span id="clear-tag" style="margin-left:6px; cursor:pointer; color:#888; font-size:14px; font-weight:bold;" title="` + t("tag_clear_title") + `">✕</span>
        </div>
        <div id="pinitgpt-list-wrap" style="flex:1; min-height:120px; overflow-y:auto; display:flex; flex-direction:column;">
            <div id="pinitgpt-list"></div>
        </div>
    </div>
    <div style="padding-top:15px; border-top:1px solid #222; margin-top:10px;">
        <div id="pinitgpt-export-label" style="margin-bottom:8px; font-size:11px; color:#666;">` + t("export_pro") + `</div>
        <div style="display:flex; gap:6px; margin-bottom:10px;">
          <button id="pinitgpt-export-csv" style="flex:1; padding:9px; background:#1a1a2e; border:1px solid #333; color:#00e5ff; border-radius:6px; cursor:pointer; font-size:11px;">` + t("export_csv") + `</button>
          <button id="pinitgpt-export-notion" style="flex:1; padding:9px; background:#1a1a2e; border:1px solid #333; color:#00e5ff; border-radius:6px; cursor:pointer; font-size:11px;">` + t("export_notion") + `</button>
        </div>
        <div id="pinitgpt-export-toast" style="display:none; font-size:11px; color:#ff5252; margin-bottom:8px;"></div>
        <button id="clear-all-pins" style="width:100%; padding:9px; background:none; border:1px solid #444; color:#666; border-radius:6px; cursor:pointer; font-size:11px;">` + t("clear_all_pins") + `</button>
        <div id="pinitgpt-early-badge-wrap" style="margin-top:12px; padding-top:10px; border-top:1px solid #222;">
          <div id="pinitgpt-early-badge" style="display:none; position:relative; cursor:default; padding:7px 10px; background:rgba(0,229,255,0.15); border:1px solid #00e5ff; border-radius:6px; font-size:11px; color:#00e5ff;"><span>` + t("early_supporter") + `</span><div id="pinitgpt-early-tooltip" style="display:none; position:absolute; bottom:100%; left:0; margin-bottom:4px; padding:8px; background:#1a1a2e; border:1px solid #333; border-radius:6px; font-size:10px; line-height:1.5; white-space:pre-line; width:200px; z-index:2147483641; color:#ddd;"></div></div>
          <button id="pinitgpt-license-remove" style="display:none; margin-top:8px; width:100%; padding:7px; background:transparent; border:1px solid #444; color:#666; border-radius:6px; cursor:pointer; font-size:11px;">` + t("license_remove_btn") + `</button>
        </div>
        <div id="pinitgpt-license-section" style="margin-top:12px; padding-top:10px; border-top:1px solid #222;">
          <input type="text" id="pinitgpt-license-in" placeholder="` + t("license_placeholder") + `" style="width:100%; box-sizing:border-box; padding:8px 10px; margin-bottom:8px; border-radius:6px; border:1px solid #333; background:#222; color:#fff; font-size:11px; outline:none;">
          <button id="pinitgpt-license-activate" style="width:100%; padding:8px; border-radius:6px; border:none; background:#00e5ff; color:#000; font-size:11px; font-weight:bold; cursor:pointer;">` + t("license_activate_btn") + `</button>
          <div id="pinitgpt-license-msg" style="display:none; font-size:11px; margin-top:6px; color:#ff5252;"></div>
        </div>
        <div id="pinitgpt-lang-wrap" style="margin-top:12px; padding-top:10px; border-top:1px solid #222; position:relative;">
          <div id="pinitgpt-lang-trigger" style="display:flex; align-items:center; gap:6px; font-size:11px; color:#888; cursor:pointer; padding:6px 0;" title="Language">🌐 <span id="pinitgpt-lang-label">` + (__pinitgpt_current_locale === "ko" ? t("lang_name_ko") : t("lang_name_en")) + `</span></div>
          <div id="pinitgpt-lang-dropdown" style="display:none; position:absolute; left:0; right:0; bottom:100%; margin-bottom:4px; background:#1a1a2e; border:1px solid #333; border-radius:8px; overflow:hidden; z-index:2147483642; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
            <div class="pinitgpt-lang-opt" data-lang="en" style="padding:8px 12px; font-size:11px; color:#eee; cursor:pointer;">English</div>
            <div class="pinitgpt-lang-opt" data-lang="ko" style="padding:8px 12px; font-size:11px; color:#eee; cursor:pointer;">한국어</div>
          </div>
        </div>
        <div id="pinitgpt-feedback-wrap" style="margin-top:10px; padding-top:10px; border-top:1px solid #1a1a1a;">
          <a id="pinitgpt-feedback-btn"
             href="https://forms.gle/78g5g7osQefrBqp26"
             target="_blank"
             rel="noopener"
             style="display:flex; align-items:center; gap:6px; font-size:11px; color:#555; text-decoration:none; padding:6px 0; cursor:pointer; transition:color 0.2s;">
            💬 <span>` + t("feedback_btn") + `</span>
          </a>
        </div>
        <div id="pinitgpt-upgrade-banner" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid #1a1a1a;">
          <div style="font-size:11px; color:#888; line-height:1.4; margin-bottom:8px;">` + t("upgrade_banner_text") + `</div>
          <button id="pinitgpt-upgrade-banner-btn" style="width:100%; padding:8px; border-radius:999px; border:none; background:linear-gradient(135deg,#22c55e,#38bdf8); color:#020617; font-size:12px; font-weight:700; cursor:pointer;">` + t("upgrade_btn") + `</button>
        </div>
    </div>
    <style>
      #pinitgpt-sidebar .view-btn { padding: 5px 9px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #efefef; cursor: pointer; font-size: 11px; white-space: nowrap; }
      #pinitgpt-sidebar .view-btn.active { border-color: #555; background: #2a2a2a; }
      #pinitgpt-sidebar .view-btn.view-btn-pro-locked { opacity: 0.65; cursor: pointer; }
      #pinitgpt-sidebar .view-btn.view-btn-pro-locked:hover { opacity: 0.9; }
      #pinitgpt-sidebar .highlight { background-color: rgba(255, 235, 59, 0.7); color: #000; padding: 0 1px; border-radius: 2px; }
      #pinitgpt-sidebar .category-row:hover { background: #222; }
      #pinitgpt-sidebar .category-row:hover .category-edit { opacity: 1 !important; }
      #pinitgpt-sidebar .category-row.active-cat { background: #2a2a2a; border: 1px solid #444; }
      #pinitgpt-sidebar .tag-item { color: #888; font-size: 11px; margin-top: 4px; cursor: pointer; display: inline-block; padding: 2px 6px; border-radius: 4px; margin-right: 4px; }
      #pinitgpt-sidebar .tag-item:hover { color: #00e5ff; background: #333; text-decoration: none; }
      #pinitgpt-sidebar .tag-item.tag-item-selected { background: rgba(0,229,255,0.2); color: #00e5ff; font-weight: bold; }
      #pinitgpt-sidebar .delete-pin-btn { color: #444; font-size: 11px; cursor: pointer; float: right; margin-top: 4px; }
      #pinitgpt-sidebar .delete-pin-btn:hover { color: #ff5252; }
      #pinitgpt-sidebar .pin-card-star { font-size: 16px; cursor: pointer; transition: all 0.2s ease; display: inline-block; }
      #pinitgpt-sidebar .pin-card-star:hover { transform: scale(1.2); }
      #pinitgpt-sidebar .pin-source { font-size: 10px; color: #666; cursor: pointer; margin-bottom: 4px; display: block; }
      #pinitgpt-sidebar .pin-source:hover { color: #00e5ff; }
      #pinitgpt-sidebar .lock-toast { font-size:11px; color:#ff5252; margin-left:6px; display:none; }
      #pinitgpt-sidebar .toast-msg { font-size:10px; color:#ff5252; margin-top:4px; }
      #pinitgpt-sidebar .pinitgpt-search-highlight { background: rgba(255, 235, 59, 0.6); color: #000; padding: 0 1px; border-radius: 2px; }
      #pinitgpt-sidebar .pinitgpt-lang-opt:hover { background: #2a2a2a; color: #00e5ff; }
      #pinitgpt-sidebar #pinitgpt-feedback-btn:hover { color: #00e5ff; }
      #pinitgpt-sidebar #pinitgpt-upgrade-banner-btn:hover { filter: brightness(1.03); }
    </style>
  `;

  window.refreshSidebarI18n = function () {
    var sb = document.getElementById("pinitgpt-sidebar");
    if (!sb) return;
    var searchClear = sb.querySelector("#pinitgpt-search-clear");
    if (searchClear) searchClear.setAttribute("title", t("search_clear_title"));
    var sortSelect = sb.querySelector("#pinitgpt-sort-select");
    if (sortSelect && sortSelect.options.length >= 2) { sortSelect.options[0].textContent = t("sort_latest"); sortSelect.options[1].textContent = t("sort_oldest"); }
    var viewLabel = sb.querySelector("#pinitgpt-view-label");
    if (viewLabel) viewLabel.textContent = t("view_label");
    sb.querySelectorAll(".view-btn").forEach(function (btn) {
      var v = btn.dataset.view;
      if (v === "all") { btn.setAttribute("data-tooltip", t("view_all_tooltip_lock")); btn.setAttribute("data-pro-tooltip", t("view_all_tooltip_pro")); }
      if (v === "current") btn.setAttribute("data-tooltip", t("view_current_tooltip"));
      if (v === "continue") { btn.setAttribute("data-tooltip", t("view_continue_tooltip_lock")); btn.setAttribute("data-pro-tooltip", t("view_continue_tooltip_pro")); }
    });
    var catLabel = sb.querySelector("#pinitgpt-category-toggle span:last-child");
    if (catLabel) catLabel.textContent = t("category_label");
    var clearTag = sb.querySelector("#clear-tag");
    if (clearTag) clearTag.setAttribute("title", t("tag_clear_title"));
    var exportLabel = sb.querySelector("#pinitgpt-export-label");
    if (exportLabel) exportLabel.textContent = t("export_pro");
    var exportCsv = sb.querySelector("#pinitgpt-export-csv");
    if (exportCsv) exportCsv.textContent = t("export_csv");
    var exportNotion = sb.querySelector("#pinitgpt-export-notion");
    if (exportNotion) exportNotion.textContent = t("export_notion");
    var clearAll = sb.querySelector("#clear-all-pins");
    if (clearAll) clearAll.textContent = t("clear_all_pins");
    var earlyBadgeSpan = sb.querySelector("#pinitgpt-early-badge span");
    if (earlyBadgeSpan) earlyBadgeSpan.textContent = t("early_supporter");
    var earlyTooltipEl = sb.querySelector("#pinitgpt-early-tooltip");
    if (earlyTooltipEl) earlyTooltipEl.textContent = t("early_supporter_tooltip");
    var licenseIn = sb.querySelector("#pinitgpt-license-in");
    if (licenseIn) licenseIn.placeholder = t("license_placeholder");
    var licenseActivate = sb.querySelector("#pinitgpt-license-activate");
    if (licenseActivate) licenseActivate.textContent = t("license_activate_btn");
    var licenseRemoveBtn = sb.querySelector("#pinitgpt-license-remove");
    if (licenseRemoveBtn) licenseRemoveBtn.textContent = t("license_remove_btn");
    var feedbackSpan = sb.querySelector("#pinitgpt-feedback-btn span");
    if (feedbackSpan) feedbackSpan.textContent = t("feedback_btn");
    var langLabel = sb.querySelector("#pinitgpt-lang-label");
    if (langLabel) langLabel.textContent = __pinitgpt_current_locale === "ko" ? t("lang_name_ko") : t("lang_name_en");
  };

  var langTrigger = sidebar.querySelector("#pinitgpt-lang-trigger");
  var langDropdown = sidebar.querySelector("#pinitgpt-lang-dropdown");
  if (langTrigger && langDropdown) {
    langTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var show = langDropdown.style.display !== "block";
      langDropdown.style.display = show ? "block" : "none";
      if (show) {
        var close = function () { langDropdown.style.display = "none"; document.removeEventListener("click", close); };
        setTimeout(function () { document.addEventListener("click", close); }, 0);
      }
    });
    sidebar.querySelectorAll(".pinitgpt-lang-opt").forEach(function (opt) {
      opt.addEventListener("click", function (e) {
        e.stopPropagation();
        var lang = opt.dataset.lang;
        if (lang !== __pinitgpt_current_locale) setLocaleAndRefresh(lang, function () { if (langDropdown) langDropdown.style.display = "none"; });
        else if (langDropdown) langDropdown.style.display = "none";
      });
    });
  }

  var clearTagEl = sidebar.querySelector("#clear-tag");
  if (clearTagEl) clearTagEl.onclick = () => { currentTagFilter = null; renderPins(); };
  var clearAllPinsEl = sidebar.querySelector("#clear-all-pins");
  if (clearAllPinsEl) clearAllPinsEl.onclick = () => { savePins(getPins().filter(p=>(p.conversationId || p.chatId) !== CHAT_ID)); renderPins(); };

  var upgradeBannerBtn = sidebar.querySelector("#pinitgpt-upgrade-banner-btn");
  if (upgradeBannerBtn) {
    upgradeBannerBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      openGumroadFromExtension("sidebar_banner");
    });
  }

  var exportToast = sidebar.querySelector("#pinitgpt-export-toast");
  function showExportLock() {
    if (!exportToast) return;
    exportToast.style.display = "block";
    exportToast.innerHTML = t("export_pro_continue").replace("%s", GUMROAD_URL);
    // Track upgrade click from export lock entrypoint
    try {
      var a = exportToast.querySelector("a");
      if (a) {
        a.addEventListener("click", function() {
          trackUpgradeClick("export_lock");
        }, { once: true });
      }
    } catch (e) {}
    setTimeout(function() { exportToast.style.display = "none"; }, 5000);
  }
  function downloadFile(filename, content, mimeType) {
    var blob = new Blob(["\uFEFF" + content], { type: mimeType + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportToCSV() {
    var pins = getPins().filter(function(p) { return (p.conversationId || p.chatId) === CHAT_ID; });
    if (pins.length === 0) { if (exportToast) { exportToast.style.display = "block"; exportToast.textContent = t("export_no_pins"); setTimeout(function() { exportToast.style.display = "none"; }, 3000); } return; }
    var headers = ["label", "chatTitle", "text", "tags", "createdAt"];
    var rows = pins.map(function(p) {
      var date = p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 19) : "";
      var chatTitle = (p.chatTitle || getCurrentChatTitle() || "").replace(/"/g, '""');
      var tagsStr = parseTags(p.tags).join(",");
      return [p.label || "", chatTitle, (p.text || "").replace(/"/g, '""'), tagsStr.replace(/"/g, '""'), date];
    });
    var csv = headers.join(",") + "\n" + rows.map(function(r) { return r.map(function(c) { return "\"" + c + "\""; }).join(","); }).join("\n");
    downloadFile("pinitgpt-pins-" + CHAT_ID + ".csv", csv, "text/csv");
  }
  function exportToNotion() {
    var pins = getPins().filter(function(p) { return (p.conversationId || p.chatId) === CHAT_ID; });
    if (pins.length === 0) { if (exportToast) { exportToast.style.display = "block"; exportToast.textContent = t("export_no_pins"); setTimeout(function() { exportToast.style.display = "none"; }, 3000); } return; }
    var lines = ["# pinitgpt Pin 내보내기", "", "| 유형 | 채팅 | 내용 | 태그 | 저장일 |", "|------|------|------|------|--------|"];
    pins.forEach(function(p) {
      var date = p.createdAt ? new Date(p.createdAt).toLocaleString("ko-KR") : "";
      var text = (p.text || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      if (text.length > 80) text = text.slice(0, 77) + "...";
      var chatTitle = (p.chatTitle || getCurrentChatTitle() || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      if (chatTitle.length > 40) chatTitle = chatTitle.slice(0, 37) + "...";
      var tagsStrNotion = parseTags(p.tags).join(", ");
      lines.push("| " + (p.label || "") + " | " + chatTitle + " | " + text + " | " + tagsStrNotion + " | " + date + " |");
    });
    downloadFile("pinitgpt-pins-" + CHAT_ID + ".md", lines.join("\n"), "text/markdown");
  }
  var exportCsvBtn = sidebar.querySelector("#pinitgpt-export-csv");
  if (exportCsvBtn) exportCsvBtn.onclick = function() {
    if (!isProUser()) { showExportLock(); return; }
    exportToCSV();
  };
  var exportNotionBtn = sidebar.querySelector("#pinitgpt-export-notion");
  if (exportNotionBtn) exportNotionBtn.onclick = function() {
    if (!isProUser()) { showExportLock(); return; }
    exportToNotion();
  };

  var earlyBadge = sidebar.querySelector("#pinitgpt-early-badge");
  var earlyTooltip = sidebar.querySelector("#pinitgpt-early-tooltip");
  if (earlyTooltip) earlyTooltip.textContent = t("early_supporter_tooltip");
  if (earlyBadge) {
    earlyBadge.addEventListener("mouseenter", function() { if (earlyTooltip) earlyTooltip.style.display = "block"; });
    earlyBadge.addEventListener("mouseleave", function() { if (earlyTooltip) earlyTooltip.style.display = "none"; });
  }

  var licenseIn = sidebar.querySelector("#pinitgpt-license-in");
  var licenseActivate = sidebar.querySelector("#pinitgpt-license-activate");
  var licenseMsg = sidebar.querySelector("#pinitgpt-license-msg");
  if (licenseActivate && licenseIn) {
    licenseActivate.addEventListener("click", function() {
      var key = (licenseIn.value && licenseIn.value.trim()) || "";
      if (!key) {
        if (licenseMsg) { licenseMsg.style.display = "block"; licenseMsg.textContent = t("license_enter"); licenseMsg.style.color = "#ff5252"; }
        return;
      }
      if (licenseMsg) { licenseMsg.style.display = "block"; licenseMsg.textContent = t("license_verifying"); licenseMsg.style.color = "#00e5ff"; }
      licenseActivate.disabled = true;
      chrome.runtime.sendMessage({ action: "verifyLicense", key: key }, function(res) {
        licenseActivate.disabled = false;
        if (chrome.runtime.lastError) {
          if (licenseMsg) { licenseMsg.textContent = t("license_error"); licenseMsg.style.color = "#ff5252"; }
          return;
        }
        if (!res || !res.verified) {
          if (licenseMsg) { licenseMsg.textContent = (res && res.message) ? res.message : t("license_invalid"); licenseMsg.style.color = "#ff5252"; }
          return;
        }
        if (licenseMsg) {
          licenseMsg.style.display = "block";
          licenseMsg.style.color = "#888";
          licenseMsg.textContent = (res.uses != null)
            ? t("license_devices_used").replace("{0}", String(res.uses)).replace("{1}", String(res.maxUses || 3))
            : "";
        }
        var license = { type: "LTD", source: "gumroad", key: key, verified: true };
        try {
          chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: license }, function() {
            user.isPro = true;
            licenseIn.value = "";
            if (typeof renderPins === "function") renderPins();
          });
        } catch (e) {}
      });
    });
  }
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

  function showUpgradeLimitModal() {
    if (!shouldShowUpgradePrompt()) return;
    markUpgradePromptShown();
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.7)",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    });
    const modal = document.createElement("div");
    Object.assign(modal.style, {
      width: "320px",
      maxWidth: "90vw",
      background: "#111827",
      borderRadius: "16px",
      border: "1px solid #374151",
      padding: "20px 18px 16px",
      color: "#e5e7eb",
      fontSize: "13px",
      boxShadow: "0 18px 45px rgba(0,0,0,0.7)"
    });
    modal.innerHTML = ''
      + '<div style="font-size:15px;font-weight:700;margin-bottom:10px;">You&#39;ve reached the free limit</div>'
      + '<div style="font-size:12px;color:#9ca3af;margin-bottom:10px;line-height:1.5;">'
      + 'Free version allows up to 5 pins in 1 chat.<br>'
      + 'Upgrade to Pro to unlock unlimited pins and stronger organization tools.'
      + '</div>'
      + '<ul style="font-size:12px;color:#d1d5db;margin:0 0 12px 18px;padding:0;">'
      + '<li>Unlimited pins</li>'
      + '<li>Global search</li>'
      + '<li>Tag filtering</li>'
      + '<li>Export pins (CSV / Markdown)</li>'
      + '<li>Continue view mode</li>'
      + '</ul>'
      + '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">'
      + '<button id="pinitgpt-upgrade-primary"'
      + ' style="padding:9px 12px;border-radius:999px;border:none;background:linear-gradient(135deg,#22c55e,#38bdf8);color:#020617;font-weight:600;cursor:pointer;">'
      + 'Upgrade to Pro'
      + '</button>'
      + '<button id="pinitgpt-upgrade-secondary"'
      + ' style="padding:8px 12px;border-radius:999px;border:1px solid #374151;background:#020617;color:#9ca3af;font-size:12px;cursor:pointer;">'
      + 'Continue with free version'
      + '</button>'
      + '</div>';
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    modal.addEventListener("click", function(e) { e.stopPropagation(); });
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    var primaryBtn = modal.querySelector("#pinitgpt-upgrade-primary");
    var secondaryBtn = modal.querySelector("#pinitgpt-upgrade-secondary");
    if (primaryBtn) {
      primaryBtn.addEventListener("click", function() {
        openGumroadFromExtension("limit_modal");
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      });
    }
    if (secondaryBtn) {
      secondaryBtn.addEventListener("click", function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      });
    }
  }

  function ensureNeutralToast() {
    var el = document.getElementById("pinitgpt-neutral-toast");
    if (el) return el;
    el = document.createElement("div");
    el.id = "pinitgpt-neutral-toast";
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      background: "rgba(17,24,39,0.96)",
      color: "#e5e7eb",
      border: "1px solid rgba(148,163,184,0.25)",
      borderRadius: "12px",
      padding: "10px 12px",
      fontSize: "12px",
      lineHeight: "1.4",
      zIndex: "2147483647",
      display: "none",
      maxWidth: "92vw",
      boxShadow: "0 18px 45px rgba(0,0,0,0.7)"
    });
    document.body.appendChild(el);
    return el;
  }

  function showNeutralToast(message) {
    var el = ensureNeutralToast();
    if (!el) return;
    el.textContent = message || "";
    el.style.display = "block";
    setTimeout(function () { el.style.display = "none"; }, 2500);
  }

  function showProUpgradeToast(message, buttonLabel, source) {
    if (!shouldShowUpgradePrompt()) return;
    markUpgradePromptShown();
    if (source) trackUpgradeClick(source);
    const toast = document.getElementById("pinitgpt-pro-toast");
    if (!toast) return;
    const rect = document.querySelector("#pinitgpt-view-row");
    if (rect) {
      const r = rect.getBoundingClientRect();
      toast.style.left = (r.left + r.width / 2) + "px";
      toast.style.top = (r.bottom + 8) + "px";
      toast.style.transform = "translateX(-50%)";
    }
    toast.innerHTML = (message || t("pro_toast_message")) + '<br><a href="' + GUMROAD_URL + '" target="_blank" rel="noopener" id="pinitgpt-pro-toast-link" style="display:inline-block; margin-top:8px; padding:6px 12px; background:#00e5ff; color:#000; border-radius:6px; font-weight:bold; font-size:11px; text-decoration:none;">' + (buttonLabel || t("upgrade_btn")) + "</a>";
    toast.style.display = "block";
    setTimeout(function() { toast.style.display = "none"; }, 5000);
  }

  const searchIn = sidebar.querySelector("#pinitgpt-search-in");
  const searchClear = sidebar.querySelector("#pinitgpt-search-clear");
  const sortSelect = sidebar.querySelector("#pinitgpt-sort-select");
  function updateSearchClearVisible() {
    if (searchClear) searchClear.style.display = (searchIn && searchIn.value.trim()) ? "block" : "none";
  }
  function clearSearch() {
    if (searchIn) { searchIn.value = ""; }
    searchQuery = "";
    updateSearchClearVisible();
    renderPins();
  }
  if (searchIn) {
    var searchDebounceTimer = null;
    searchIn.addEventListener("input", function() {
      if (!isProUser() && (this.value || "").trim()) {
        // Pro search is locked: keep behavior additive (show prompt), do not change pin logic.
        this.value = "";
        searchQuery = "";
        updateSearchClearVisible();
        showProUpgradeToast(t("pro_toast_message") + "<br>" + t("pro_toast_body"), t("upgrade_btn"), "search_lock");
        return;
      }
      searchQuery = this.value.trim();
      updateSearchClearVisible();
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(function() { searchDebounceTimer = null; renderPins(); }, 280);
    });
    searchIn.addEventListener("keyup", function(e) { if (e.key === "Escape") clearSearch(); });
  }
  if (searchClear) searchClear.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); clearSearch(); });
  if (sortSelect) {
    sortSelect.value = sortMode === "latest" ? "latest" : "oldest";
    sortSelect.addEventListener("change", function() { sortMode = this.value; renderPins(); });
  }

  sidebar.querySelectorAll(".view-btn").forEach(btn => {
    btn.onclick = () => {
      const view = btn.dataset.view;
      const isProOnly = view === "all" || view === "continue";
      if (isProOnly && !isProUser()) {
        showProUpgradeToast(t("pro_toast_message") + "<br>" + t("pro_toast_body"), t("upgrade_btn"), view === "all" ? "view_all" : "view_continue");
        return;
      }
      filterMode = view;
      currentFilter = "all";
      currentTagFilter = null;
      searchQuery = "";
      var searchInput = document.getElementById("pinitgpt-search-in");
      if (searchInput) searchInput.value = "";
      sidebar.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const list = document.getElementById("pinitgpt-list");
      if (list) list.scrollTop = 0;
      renderPins();
    };
    var tooltip = sidebar.querySelector("#pinitgpt-filter-tooltip");
    if (tooltip) {
      btn.addEventListener("mouseenter", function(e) {
        var r = btn.getBoundingClientRect();
        tooltip.textContent = isProUser() && btn.dataset.proTooltip ? btn.dataset.proTooltip : (btn.dataset.tooltip || "");
        tooltip.style.display = "block";
        tooltip.style.left = (r.left + r.width / 2) + "px";
        tooltip.style.top = (r.top - 4) + "px";
        tooltip.style.transform = "translate(-50%, -100%)";
      });
      btn.addEventListener("mouseleave", function() { tooltip.style.display = "none"; });
    }
  });

  const categoryToggle = sidebar.querySelector("#pinitgpt-category-toggle");
  const categoryList = sidebar.querySelector("#pinitgpt-category-list");
  const categoryArrow = sidebar.querySelector("#pinitgpt-category-arrow");
  if (categoryToggle && categoryList) {
    function updateCategoryCollapse() {
      categoryCollapsed = !categoryCollapsed;
      categoryList.style.display = categoryCollapsed ? "none" : "block";
      if (categoryArrow) categoryArrow.textContent = categoryCollapsed ? "▸" : "▾";
    }
    categoryToggle.onclick = updateCategoryCollapse;
    categoryList.style.display = categoryCollapsed ? "none" : "block";
    if (categoryArrow) categoryArrow.textContent = categoryCollapsed ? "▸" : "▾";
  }

  function refreshCategoryLabels() {
    const names = getCategoryNames();
    sidebar.querySelectorAll(".category-row").forEach(row => {
      const key = row.dataset.filter;
      const labelEl = row.querySelector(".category-label");
      if (labelEl && names[key]) labelEl.textContent = names[key];
    });
  }
  function bindCategoryRows() {
    sidebar.querySelectorAll(".category-row").forEach(row => {
      const key = row.dataset.filter;
      const labelEl = row.querySelector(".category-label");
      const editEl = row.querySelector(".category-edit");
      row.onclick = (e) => {
        if (e.target === editEl || (editEl && editEl.contains(e.target))) return;
        currentFilter = key === "starred" ? "starred" : key;
        sidebar.querySelectorAll(".category-row").forEach(r => r.classList.remove("active-cat"));
        row.classList.add("active-cat");
        renderPins();
      };
      if (editEl && editEl.style.display !== "none" && isProUser() && key !== "all" && key !== "continue") {
        editEl.onclick = (e) => {
          e.stopPropagation();
          const names = getCategoryNames();
          const currentName = names[key] || "";
          const input = document.createElement("input");
          input.type = "text";
          input.value = currentName;
          input.style.cssText = "width:100%; padding:4px 6px; border:1px solid #00e5ff; border-radius:4px; background:#222; color:#fff; font-size:12px; outline:none;";
          labelEl.style.display = "none";
          row.insertBefore(input, labelEl);
          input.focus();
          input.select();
          function finish(apply) {
            if (apply) {
              const v = input.value.trim();
              if (v) { saveCategoryName(key, v); labelEl.textContent = v; }
            }
            input.remove();
            labelEl.style.display = "";
          }
          input.addEventListener("keydown", function(ev) {
            if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
            if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
          });
          input.addEventListener("blur", function() { finish(true); });
        };
      }
    });
    refreshCategoryLabels();
  }
  bindCategoryRows();

  function applyProFreeUI() {
    if (!isProUser()) filterMode = "current";
    document.querySelectorAll(".category-row").forEach(row => {
      const editEl = row.querySelector(".category-edit");
      if (!editEl) return;
      if (row.dataset.filter === "all" || row.dataset.filter === "continue") editEl.style.display = "none";
      else editEl.style.display = isProUser() ? "" : "none";
    });
    bindCategoryRows();
  }
  applyProFreeUI();

  document.body.appendChild(sidebar);
  const proToast = document.createElement("div");
  proToast.id = "pinitgpt-pro-toast";
  Object.assign(proToast.style, { display: "none", position: "fixed", zIndex: "2147483643", padding: "14px 18px", background: "#1a1a2e", border: "1px solid #00e5ff", borderRadius: "10px", color: "#fff", fontSize: "12px", lineHeight: "1.5", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: "260px" });
  document.body.appendChild(proToast);
  renderPins();
  showFirstTimeGuide();
}

/* =====================
   2-Step Modal + Pro Lock
===================== */
function showCategoryPopup(msgElement, text, blockInfo) {
  blockInfo = blockInfo || null;
  const overlay = document.createElement("div");
  overlay.id = "pinit-modal-overlay";
  Object.assign(overlay.style, { position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", zIndex: "2147483647", display: "flex", alignItems: "center", justifyContent: "center" });
  const modal = document.createElement("div");
  Object.assign(modal.style, { background: "#171717", padding: "24px", borderRadius: "16px", width: "320px", textAlign: "center", color: "#fff", border: "1px solid #333" });

  const renderStep1 = () => {
      const names = getCategoryNames();
      const typeMap = {
        "blue": { color: "blue", label: names.blue || t("cat_blue"), type: "normal" },
        "red": { color: "red", label: names.red || t("cat_red"), type: "normal" },
        "green": { color: "green", label: names.green || t("cat_green"), type: "normal" },
        "gold": { color: "gold", label: names.gold || t("cat_gold"), type: "normal" },
        "continue": { color: "cyan", label: t("modal_opt_continue"), type: "continue" }
      };
      modal.innerHTML = `<div style="font-size:16px; font-weight:bold; margin-bottom:20px;">` + t("modal_type_title") + `</div>
          <div style="display:flex; flex-direction:column; gap:10px;">
          <button data-type="blue" class="modal-opt">${names.blue || t("cat_blue")}</button>
          <button data-type="red" class="modal-opt">${names.red || t("cat_red")}</button>
          <button data-type="green" class="modal-opt">${names.green || t("cat_green")}</button>
          <button data-type="gold" class="modal-opt">${names.gold || t("cat_gold")}</button>
          <button data-type="continue" class="modal-opt" style="background:none; border:none; text-align:left; color:#00e5ff;">` + t("modal_opt_continue") + `</button></div>
          <style>#pinit-modal-overlay .modal-opt { padding:12px; border-radius:10px; border:1px solid #333; background:#262626; color:#fff; cursor:pointer; text-align:left; } #pinit-modal-overlay .modal-opt:hover { background:#333; }</style>`;
      modal.querySelectorAll("button.modal-opt").forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); renderStep2(typeMap[btn.dataset.type]); };
      });
  };

  const renderStep2 = (conf) => {
      modal.innerHTML = `<div style="font-size:17px; font-weight:bold; margin-bottom:15px;">` + t("modal_tag_title") + `</div>
      <input type="text" id="tag-in" placeholder="` + t("modal_tag_placeholder") + `" style="width:100%; padding:12px; border-radius:8px; background:#222; border:1px solid #444; color:#fff; margin-bottom:8px; outline:none;">
      <div id="star-btn-modal" style="margin-bottom:10px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; padding:8px 16px; border-radius:20px; border:1px solid #333; background:#222;">
        <span id="m-star-icon" style="font-size:18px; color:#555;">★</span> <span style="font-size:13px; color:#aaa;">` + t("modal_star_label") + `</span>
        <span class="lock-toast" id="star-lock">[🔒 Pro]</span>
      </div>
      <div id="pin-limit-toast" class="toast-msg"></div>
      <div id="tag-limit-toast" class="toast-msg"></div>
      <button id="save-final-btn" style="width:100%; padding:12px; background:#00e5ff; border:none; border-radius:8px; color:#000; font-weight:bold; cursor:pointer;">` + t("modal_save_btn") + `</button>`;
      
      let starred = false;
      const starLock = modal.querySelector("#star-lock");
      const pinLimitToast = modal.querySelector("#pin-limit-toast");
      const tagLimitToast = modal.querySelector("#tag-limit-toast");

      starLock.style.display="none";

      modal.querySelector("#star-btn-modal").onclick = () => { 
        if(!isPro("STAR")) { starLock.style.display="inline"; setTimeout(()=>starLock.style.display="none",1500); return; }
        starred = !starred; 
        modal.querySelector("#m-star-icon").style.color = starred ? "#ffca28" : "#555"; 
      };

      const input = modal.querySelector("#tag-in");
      input.focus();

      const saveBtn = modal.querySelector("#save-final-btn");
      saveBtn.onclick = () => {
          pinLimitToast.innerText = "";
          tagLimitToast.innerText = "";
          const pins = getPins();
          const pinCount = pins.filter(p=>(p.conversationId || p.chatId) === CHAT_ID).length;
          const projectChatIds = [...new Set(pins.map(p=>p.conversationId || p.chatId))];

          if (!isProUser()) {
            if (pinCount >= LIMITS.FREE.PINS_PER_PROJECT) {
              if (shouldShowUpgradePrompt()) {
                showUpgradeLimitModal();
              }
              pinLimitToast.innerHTML = t("pin_limit_toast").replace("%s", String(LIMITS.FREE.PINS_PER_PROJECT)) + "<br><a href=\"" + GUMROAD_URL + "\" target=\"_blank\" rel=\"noopener\" style=\"color:#00e5ff; text-decoration:underline; font-weight:bold; margin-top:6px; display:inline-block;\">" + t("pin_limit_continue") + "</a>";
              return;
            }
            if (projectChatIds.length >= LIMITS.FREE.PROJECTS && !projectChatIds.includes(CHAT_ID)) { pinLimitToast.innerHTML = t("free_notice_one_chat"); return; }
          }

          let raw = input.value.trim();
          const tags = raw.split(',').map(function(x){ return x.trim(); }).filter(function(x){ return x !== ""; });
          if(!isPro("TAG_UNLIMITED") && tags.length > 3){ tagLimitToast.innerText = t("tag_limit_toast"); return; }

          saveBtn.disabled = true;
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (!msgElement.dataset.pinitId) {
            var allMsgs = document.querySelectorAll("div[data-message-author-role]");
            var idx = Array.prototype.indexOf.call(allMsgs, msgElement);
            msgElement.dataset.pinitId = "msg-" + (idx >= 0 ? idx : allMsgs.length) + "-" + (msgElement.textContent || "").length;
          }
          const p = getPins();
          const isContinue = conf.type === "continue";
          const pinData = {
            id: crypto.randomUUID(),
            chatId: CHAT_ID,
            conversationId: CHAT_ID,
            chatTitle: getCurrentChatTitle(),
            messageId: msgElement.dataset.pinitId,
            title: conf.label || text.slice(0, 80),
            content: text,
            text,
            label: conf.label,
            color: conf.color,
            category: conf.color,
            type: conf.type || "normal",
            isContinue,
            tags: tags.join(","),
            isStarred: starred,
            createdAt: Date.now()
          };
          if (blockInfo && blockInfo.blockIndex != null) {
            pinData.blockIndex = blockInfo.blockIndex;
            pinData.blockType = blockInfo.blockType || "paragraph";
            pinData.blockTextHead = blockInfo.blockTextHead || getBlockTextHead(text);
          }
          var isFirstPinInChat = (pinCount === 0);
          p.push(pinData);
          savePins(p);
          filterMode = "current";
          currentFilter = (conf.type === "continue" ? "all" : conf.color);
          renderPins();
          // First pin success moment: neutral toast only (no upgrade CTA)
          if (isFirstPinInChat) {
            showNeutralToast(t("pinned_success_toast").replace("{0}", String(LIMITS.FREE.PINS_PER_PROJECT)));
          }
      };
  };
  modal.onclick = (e) => e.stopPropagation();
  overlay.appendChild(modal); document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); } };
  renderStep1();
}

function showFirstTimeGuide() {
  if (localStorage.getItem(FIRST_GUIDE_SEEN_KEY)) return;
  var guide = document.createElement("div");
  guide.id = "pinitgpt-first-guide";
  Object.assign(guide.style, {
    position: "fixed", bottom: "24px", right: "320px", zIndex: "2147483639",
    padding: "12px 14px", background: "#1a1a2e", border: "1px solid #333", borderRadius: "10px",
    fontSize: "12px", color: "#ddd", lineHeight: "1.5", boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
  });
  guide.innerHTML = t("first_guide_title") + "<br><span style=\"font-size:11px; color:#888;\">" + t("first_guide_body").replace(/<br>/g, "<br>") + "</span>";
  guide.onclick = function() {
    localStorage.setItem(FIRST_GUIDE_SEEN_KEY, "1");
    if (guide.parentNode) guide.parentNode.removeChild(guide);
  };
  document.body.appendChild(guide);
  setTimeout(function() {
    localStorage.setItem(FIRST_GUIDE_SEEN_KEY, "1");
    if (guide.parentNode) guide.parentNode.removeChild(guide);
  }, 6000);
}

/* =====================
   Render & Logic
===================== */
function renderPins() {
  const list = document.getElementById("pinitgpt-list");
  if (!list) return;

  // Pro가 아닐 때만 current로 고정. All 버튼이 이미 선택돼 있으면 사용자 선택 존중(라이선스 로드 지연 시 리스트 유지)
  var allBtnActive = document.querySelector(".view-btn[data-view=\"all\"].active");
  if (!isProUser() && !allBtnActive) filterMode = "current";
  const searchRow = document.getElementById("pinitgpt-search-row");
  const viewRow = document.getElementById("pinitgpt-view-row");
  const searchLabel = document.getElementById("pinitgpt-search-label");
  const searchInput = document.getElementById("pinitgpt-search-in");
  if (searchRow) searchRow.style.display = "flex";
  if (searchLabel) { searchLabel.textContent = isProUser() ? t("search") : t("search_pro_lock"); searchLabel.style.whiteSpace = "nowrap"; searchLabel.style.flexShrink = "0"; }
  if (searchInput) { searchInput.disabled = !isProUser(); searchInput.placeholder = isProUser() ? t("search_placeholder") : t("search_placeholder_pro"); }
  var searchClearEl = document.getElementById("pinitgpt-search-clear");
  if (searchClearEl && searchInput) searchClearEl.style.display = searchInput.value.trim() ? "block" : "none";
  if (viewRow) {
    viewRow.querySelectorAll(".view-btn").forEach(btn => {
      const view = btn.dataset.view;
      const isProOnly = view === "all" || view === "continue";
      const pro = isProUser();
      btn.classList.toggle("view-btn-pro-locked", isProOnly && !pro);
      btn.classList.toggle("active", btn.dataset.view === filterMode);
      if (view === "all") btn.textContent = pro ? t("view_all_unlock") : t("view_all_lock");
      if (view === "current") btn.textContent = t("view_current");
      if (view === "continue") btn.textContent = pro ? t("view_continue_unlock") : t("view_continue_lock");
    });
    document.querySelectorAll(".category-row").forEach(row => {
      const editEl = row.querySelector(".category-edit");
      if (!editEl) return;
      if (row.dataset.filter === "all" || row.dataset.filter === "continue") editEl.style.display = "none";
      else editEl.style.display = isProUser() ? "" : "none";
    });
  }
  const sortSelect = document.getElementById("pinitgpt-sort-select");
  if (sortSelect) sortSelect.value = sortMode === "latest" ? "latest" : "oldest";

  const allPins = getPins().map(normalizePin);
  const currentConversationId = getCurrentConversationId();
  const curIdStr = String(currentConversationId || "");
  const projectChatIds = [...new Set(allPins.map(function(p) { return p.conversationId || p.chatId; }))];
  const pins = allPins.filter(function(p) { return String(p.conversationId || p.chatId || "") === curIdStr; });

  const freeNotice = document.getElementById("pinitgpt-free-notice");
  if (freeNotice && !isProUser() && projectChatIds.length >= LIMITS.FREE.PROJECTS && !projectChatIds.includes(currentConversationId)) {
    freeNotice.style.display = "block";
    freeNotice.innerHTML = t("free_notice_one_chat");
  } else if (freeNotice) {
    freeNotice.style.display = "none";
  }

  var earlyBadgeEl = document.getElementById("pinitgpt-early-badge");
  if (earlyBadgeEl) earlyBadgeEl.style.display = isProUser() ? "block" : "none";
  var licenseSection = document.getElementById("pinitgpt-license-section");
  if (licenseSection) licenseSection.style.display = isProUser() ? "none" : "block";
  var licenseRemoveBtnEl = document.getElementById("pinitgpt-license-remove");
  if (licenseRemoveBtnEl) licenseRemoveBtnEl.style.display = isProUser() ? "block" : "none";
  var upgradeBanner = document.getElementById("pinitgpt-upgrade-banner");
  if (upgradeBanner) upgradeBanner.style.display = isProUser() ? "none" : "block";

  var planBadge = document.getElementById("pinitgpt-plan-badge");
  var usageGauge = document.getElementById("pinitgpt-usage-gauge");
  if (planBadge) {
    if (isProUser()) {
      planBadge.textContent = t("plan_pro");
      planBadge.style.background = "linear-gradient(90deg, #00e5ff, #00b8d4)";
      planBadge.style.color = "#000";
      if (usageGauge) usageGauge.style.display = "none";
    } else {
      planBadge.textContent = t("plan_free");
      planBadge.style.background = "#333";
      planBadge.style.color = "#888";
      if (usageGauge) {
        usageGauge.style.display = "block";
        var pinCount = pins.length;
        var limit = LIMITS.FREE.PINS_PER_PROJECT;
        var gaugeText = document.getElementById("pinitgpt-gauge-text");
        var barEl = document.getElementById("pinitgpt-gauge-bar");
        if (gaugeText) gaugeText.textContent = t("pin_gauge").replace("{0}", String(pinCount)).replace("{1}", String(limit));
        if (barEl) barEl.style.width = Math.min(100, (pinCount / limit) * 100) + "%";
      }
    }
  }

  // 1) 보기 범위 필터 (viewMode) — current일 때만 현재 채팅 ID와 문자열로 비교
  let filtered = filterMode === "all"
    ? allPins
    : (filterMode === "continue"
      ? allPins.filter(function(p) { return !!p.isContinue; })
      : allPins.filter(function(p) { return String(p.conversationId || p.chatId || "") === curIdStr; }));

  // View All + 카테고리 All 이면 태그/검색 무시 → 항상 전체 목록 표시 (미개선 이슈 방지)
  var isViewAndCategoryAll = (filterMode === "all" && currentFilter === "all");

  // 2) 태그 필터 (selectedTag) — 단일 태그만 적용 (All/All이면 스킵)
  if (!isViewAndCategoryAll && currentTagFilter) {
    filtered = filtered.filter(pin => {
      const tags = parseTags(pin.tags);
      return tags.length > 0 && tags.includes(currentTagFilter);
    });
  }

  // 3) 검색어 필터 (keyword) — DOM 동기화 (All/All이면 스킵)
  var searchInputEl = document.getElementById("pinitgpt-search-in");
  if (searchInputEl) searchQuery = (searchInputEl.value || "").trim();
  const keyword = (isViewAndCategoryAll ? "" : (isProUser() ? searchQuery : ""));
  if (keyword !== "") {
    filtered = filtered.filter(pin =>
      (pin.title && pin.title.toLowerCase().includes(keyword.toLowerCase())) ||
      (pin.content && pin.content.toLowerCase().includes(keyword.toLowerCase()))
    );
  }

  // scopeForCount = 지금까지 적용된 범위(보기+태그+검색). 카운트는 이 범위 기준으로 해서 목록과 숫자 일치
  const scopeForCount = filtered.slice();

  // 4) 카테고리 필터
  filtered = filtered.filter(p => {
    const mF = (currentFilter === "all") || (currentFilter === "starred" ? p.isStarred : (currentFilter === "continue" ? p.isContinue : p.category === currentFilter || p.color === currentFilter));
    return mF;
  });

  // View All + 카테고리 All인데 filtered가 비어 있으면(allPins는 있는데 목록만 0인 경우) 복구
  if (isViewAndCategoryAll && allPins.length > 0 && filtered.length === 0) {
    filtered = allPins.slice();
  }

  // 5) 정렬 (항상 마지막)
  filtered.sort((a, b) => {
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
    return sortMode === "latest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
  });

  const counts = {
    all: scopeForCount.length,
    starred: scopeForCount.filter(p => p.isStarred).length,
    blue: scopeForCount.filter(p => (p.category === "blue" || p.color === "blue") && !p.isContinue).length,
    red: scopeForCount.filter(p => p.category === "red" || p.color === "red").length,
    green: scopeForCount.filter(p => p.category === "green" || p.color === "green").length,
    gold: scopeForCount.filter(p => p.category === "gold" || p.color === "gold").length,
    continue: scopeForCount.filter(p => p.isContinue).length
  };
  document.querySelectorAll(".category-row").forEach(row => {
    const k = row.dataset.filter;
    row.classList.toggle("active-cat", currentFilter === k);
    const labelEl = row.querySelector(".category-label");
    const names = getCategoryNames();
    const baseName = k === "all" ? t("category_all") : (names[k] || "");
    const cnt = counts[k] != null ? counts[k] : 0;
    if (labelEl) labelEl.textContent = baseName + " (" + cnt + ")";
  });

  const tagArea = document.getElementById("active-tag-area");
  if (currentTagFilter) {
    tagArea.style.display = "block";
    const tagLabel = document.getElementById("tag-label");
    if (tagLabel) tagLabel.textContent = t("tag_filter_prefix") + currentTagFilter + " ";
  } else {
    tagArea.style.display = "none";
  }

  list.innerHTML = "";

  function escapeHtml(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function highlight(text, keyword) {
    if (!keyword || !text) return escapeHtml(text || "");
    const escaped = escapeHtml(text);
    const k = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("(" + k + ")", "gi");
    return escaped.replace(regex, "<span class='highlight'>$1</span>");
  }

  if (filtered.length === 0) {
    list.innerHTML = "<div style='padding:20px; text-align:center; color:#888; font-size:12px;'>" + t("no_results") + "</div>";
    return;
  }

  filtered.forEach(p => {
      const item = document.createElement("div");
      Object.assign(item.style, { 
        border: "1px solid #222", 
        borderLeft: `5px solid ${p.isContinue ? "#00e5ff" : (p.color || p.category || "#555")}`, 
        borderRadius: "4px", 
        padding: "5px 8px", 
        marginBottom: "4px", 
        background: "#181818" 
      });
      
      const pinConvId = p.conversationId || p.chatId || "";
      const tagList = parseTags(p.tags);
      const tagsHtml = tagList.map(tagVal => {
        const isSelected = currentTagFilter === tagVal;
        return `<span class="tag-item${isSelected ? " tag-item-selected" : ""}" data-tag="${escapeHtml(tagVal)}" data-conversation-id="${escapeHtml(pinConvId)}">#${escapeHtml(tagVal)}</span>`;
      }).join(' ');
      const displayTitle = highlight(p.title, keyword);
      const displayContent = highlight(p.content, keyword);
      const showSource = (filterMode === "all" || filterMode === "continue");
      var genericFallback = t("chat_id_fallback").replace("{id}", String(pinConvId).slice(0, 8));
      var fromPage = showSource ? getConversationTitleFromPage(pinConvId) : "";
      var storedTitle = p.chatTitle || "";
      var isGenericId = !storedTitle || storedTitle === genericFallback || storedTitle === t("chat") || /^(Chat|채팅)\s+[a-f0-9]+$/i.test((storedTitle || "").trim());
      var displayChatTitle = (fromPage && fromPage.length > 0) ? fromPage : (storedTitle && !isGenericId ? storedTitle : genericFallback);
      const sourceLabel = showSource ? ("<div class=\"pin-source\" data-conversation-id=\"" + escapeHtml(pinConvId) + "\" title=\"" + escapeHtml(t("source_go_title")) + "\">📁 " + escapeHtml(displayChatTitle) + "</div>") : "";

      item.innerHTML = sourceLabel + `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
            <span style="font-size:11px; opacity:.4;">${displayTitle || escapeHtml(p.label || "")}</span>
            <span class="pin-card-star" style="color:${p.isStarred ? '#ffca28' : '#333'}"></span>
        </div>
        <div class="p-txt" style="cursor:pointer; font-size:13px; color:#ddd; margin-bottom:4px; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${displayContent}</div>
        <div style="overflow:hidden;"><span class="tag-wrap">${tagsHtml}</span><span class="delete-pin-btn">` + t("delete_pin") + `</span></div>`;
      
      const sourceEl = item.querySelector(".pin-source");
      if (sourceEl) {
        sourceEl.onclick = (e) => {
          e.stopPropagation();
          const convId = sourceEl.dataset.conversationId || pinConvId;
          if (!convId) return;
          if (convId !== CHAT_ID) {
            try {
              var snippet = (p.content || p.text || "").slice(0, 200).replace(/\s+/g, " ").trim();
              var pending = { conversationId: convId, messageId: p.messageId, contentSnippet: snippet };
              if (p.blockIndex != null) pending.blockIndex = p.blockIndex;
              if (p.blockTextHead) pending.blockTextHead = p.blockTextHead;
              sessionStorage.setItem(PENDING_SCROLL_KEY, JSON.stringify(pending));
              location.href = location.origin + "/c/" + convId;
            } catch (err) {}
            return;
          }
          scrollToPinTarget(p);
        };
      }

      const starIcon = item.querySelector(".pin-card-star");
      starIcon.innerText = "★";
      starIcon.onclick = (e) => {
          e.stopPropagation();
          if(!isPro("STAR")) { starIcon.style.color="#ff5252"; setTimeout(()=>starIcon.style.color="#333",1500); return; }
          const ps = getPins();
          const target = ps.find(x => x.id === p.id);
          if(target){ target.isStarred = !target.isStarred; savePins(ps); renderPins(); }
      };

      item.querySelector(".p-txt").onclick = () => {
          const pinConv = p.conversationId || p.chatId;
          const isOtherChat = pinConv && pinConv !== CHAT_ID;
          if (isOtherChat) {
            try {
              const snippet = (p.content || p.text || "").slice(0, 200).replace(/\s+/g, " ").trim();
              var pending = { conversationId: pinConv, messageId: p.messageId, contentSnippet: snippet };
              if (p.blockIndex != null) pending.blockIndex = p.blockIndex;
              if (p.blockTextHead) pending.blockTextHead = p.blockTextHead;
              sessionStorage.setItem(PENDING_SCROLL_KEY, JSON.stringify(pending));
              location.href = location.origin + "/c/" + pinConv;
              return;
            } catch (e) {}
          }
          scrollToPinTarget(p);
      };

      item.querySelector(".delete-pin-btn").onclick = (e)=>{ e.stopPropagation(); savePins(getPins().filter(x=>x.id!==p.id)); renderPins(); };
      item.querySelectorAll(".tag-item").forEach(t => {
        t.onclick = (e) => {
          e.stopPropagation();
          const tagVal = (t.dataset.tag || (t.textContent || "").replace(/^#/, "").trim()) || null;
          const convId = t.dataset.conversationId || "";
          if (filterMode === "all" && convId && convId !== CHAT_ID) {
            try {
              sessionStorage.setItem(PENDING_TAG_KEY, tagVal || "");
              location.href = location.origin + "/c/" + convId;
              return;
            } catch (err) {}
          }
          if (filterMode === "all" && convId === CHAT_ID) filterMode = "current";
          currentTagFilter = tagVal;
          renderPins();
        };
      });

      list.appendChild(item);
  });
}

var pinitgptCurrentBlock = null;
var pinitgptBlockPinHideTimer = null;

function ensureBlockPinButton() {
  var el = document.getElementById("pinitgpt-block-pin-btn");
  if (el) return el;
  el = document.createElement("button");
  el.id = "pinitgpt-block-pin-btn";
  el.className = "pinitgpt-block-pin-btn";
  el.innerText = "📌";
  el.title = t("pin_guide_text");
  Object.assign(el.style, {
    position: "fixed", display: "none", zIndex: "2147483641",
    padding: "6px 10px", borderRadius: "6px", background: "#222", color: "#fff",
    border: "1px solid #00e5ff", cursor: "pointer", fontSize: "14px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
  });
  el.addEventListener("mouseenter", function () {
    if (pinitgptBlockPinHideTimer) { clearTimeout(pinitgptBlockPinHideTimer); pinitgptBlockPinHideTimer = null; }
  });
  el.addEventListener("mouseleave", function () {
    hideBlockPinButton();
  });
  el.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var cur = pinitgptCurrentBlock;
    hideBlockPinButton();
    if (cur && cur.msg && cur.block) {
      var blockText = (cur.block.textContent || "").trim();
      if (blockText) {
        showCategoryPopup(cur.msg, blockText, {
          blockIndex: cur.index,
          blockType: cur.type,
          blockTextHead: cur.textHead
        });
      }
    }
  });
  document.body.appendChild(el);
  return el;
}

function showBlockPinButton(blockRect, cur) {
  pinitgptCurrentBlock = cur;
  var btn = ensureBlockPinButton();
  btn.style.left = (blockRect.left - 42) + "px";
  btn.style.top = (blockRect.top + blockRect.height / 2 - 14) + "px";
  btn.style.display = "block";
}

function hideBlockPinButton() {
  if (pinitgptBlockPinHideTimer) clearTimeout(pinitgptBlockPinHideTimer);
  pinitgptBlockPinHideTimer = setTimeout(function () {
    pinitgptBlockPinHideTimer = null;
    pinitgptCurrentBlock = null;
    var btn = document.getElementById("pinitgpt-block-pin-btn");
    if (btn) btn.style.display = "none";
  }, 100);
}

function scrollToPinTarget(p) {
  var msgEl = document.querySelector("[data-pinit-id=\"" + (p.messageId || "") + "\"]");
  if (!msgEl && (p.content || p.text)) {
    var snippet = (p.content || p.text || "").replace(/\s+/g, " ").trim().slice(0, 200);
    var messages = document.querySelectorAll("div[data-message-author-role]");
    for (var i = 0; i < messages.length; i++) {
      var mt = (messages[i].textContent || "").replace(/\s+/g, " ").trim();
      if (snippet.length >= 20 && mt.indexOf(snippet.slice(0, 80)) !== -1) { msgEl = messages[i]; break; }
      if (snippet.length < 20 && mt.indexOf(snippet) !== -1) { msgEl = messages[i]; break; }
    }
  }
  if (!msgEl) return;
  var highlightEl = msgEl;
  if (p.blockIndex != null && p.blockIndex >= 0) {
    var blocks = getBlocksInMessage(msgEl);
    var head = (p.blockTextHead || getBlockTextHead(p.content || p.text || "")).replace(/\s+/g, " ").trim().slice(0, BLOCK_TEXT_HEAD_LEN);
    if (blocks[p.blockIndex]) {
      var blockText = (blocks[p.blockIndex].textContent || "").replace(/\s+/g, " ").trim().slice(0, BLOCK_TEXT_HEAD_LEN);
      if (!head || blockText.indexOf(head) !== -1 || head.indexOf(blockText) !== -1) {
        highlightEl = blocks[p.blockIndex];
      }
    }
    if (highlightEl === msgEl && head) {
      for (var i = 0; i < blocks.length; i++) {
        var bt = (blocks[i].textContent || "").replace(/\s+/g, " ").trim().slice(0, BLOCK_TEXT_HEAD_LEN);
        if (bt.indexOf(head) !== -1 || head.indexOf(bt) !== -1) {
          highlightEl = blocks[i];
          break;
        }
      }
    }
  }
  highlightEl.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(function () {
    window.scrollBy({ top: -120, behavior: "smooth" });
    highlightEl.style.transition = "background-color 0.4s";
    highlightEl.style.backgroundColor = "rgba(255,250,200,0.5)";
    setTimeout(function () { highlightEl.style.backgroundColor = ""; }, 2000);
  }, 350);
}

// 블록 Pin: 이벤트 위임(전체 DOM 1회만 감시, 블록별 리스너 대량 부착 제거 → 부하 감소)
function setupBlockPinDelegation() {
  if (window.pinitgptBlockDelegationDone) return;
  window.pinitgptBlockDelegationDone = true;
  document.addEventListener("mouseover", function (e) {
    if (e.target.closest("#pinitgpt-block-pin-btn")) return;
    var block = e.target.closest(BLOCK_TAG_SELECTOR);
    if (!block) return;
    var msg = block.closest("div[data-message-author-role]");
    if (!msg) return;
    var blocks = getBlocksInMessage(msg);
    var index = blocks.indexOf(block);
    if (index < 0) return;
    if (pinitgptBlockPinHideTimer) { clearTimeout(pinitgptBlockPinHideTimer); pinitgptBlockPinHideTimer = null; }
    var textHead = getBlockTextHead((block.textContent || "").trim());
    showBlockPinButton(block.getBoundingClientRect(), { msg: msg, block: block, index: index, type: getBlockType(block), textHead: textHead });
  }, true);
  document.addEventListener("mouseout", function (e) {
    if (e.relatedTarget && (e.relatedTarget.closest(BLOCK_TAG_SELECTOR) || e.relatedTarget.id === "pinitgpt-block-pin-btn" || e.relatedTarget.closest("#pinitgpt-block-pin-btn"))) return;
    hideBlockPinButton();
  }, true);
}

function addPinButtons() {
  const messages = document.querySelectorAll("div[data-message-author-role]");
  messages.forEach((msg, index) => {
    if (!msg.dataset.pinitId) msg.dataset.pinitId = "msg-" + index + "-" + (msg.textContent || "").length;
    if (msg.querySelector(".pinitgpt-pin-btn")) return;
    msg.style.position = "relative";
    const btn = document.createElement("button");
    btn.className = "pinitgpt-pin-btn"; btn.innerText = "📌";
    Object.assign(btn.style, { position: "absolute", top: "10px", right: "-45px", padding: "5px 8px", borderRadius: "6px", background: "#222", color: "#fff", border: "1px solid #333", cursor: "pointer", zIndex: "100" });
    btn.onclick = () => showCategoryPopup(msg, (msg.textContent || "").trim());

    var guideTooltip = null;
    btn.addEventListener("mouseenter", function() {
      if (localStorage.getItem(PIN_GUIDE_SEEN_KEY)) return;
      if (guideTooltip && guideTooltip.parentNode) return;
      var rect = btn.getBoundingClientRect();
      guideTooltip = document.createElement("div");
      guideTooltip.id = "pinitgpt-pin-guide";
      Object.assign(guideTooltip.style, {
        position: "fixed", left: (rect.left + rect.width / 2) + "px", top: (rect.top - 8) + "px",
        transform: "translate(-50%, -100%)", padding: "6px 10px", background: "#1a1a2e", color: "#00e5ff",
        border: "1px solid #333", borderRadius: "8px", fontSize: "11px", whiteSpace: "nowrap",
        zIndex: "2147483642", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none"
      });
      guideTooltip.textContent = t("pin_guide_text");
      document.body.appendChild(guideTooltip);
      localStorage.setItem(PIN_GUIDE_SEEN_KEY, "1");
      setTimeout(function() {
        if (guideTooltip && guideTooltip.parentNode) { guideTooltip.remove(); guideTooltip = null; }
      }, 2500);
    });
    btn.addEventListener("mouseleave", function() {
      if (guideTooltip && guideTooltip.parentNode) { guideTooltip.remove(); guideTooltip = null; }
    });

    msg.appendChild(btn);
  });
}

function applyPendingTagFilter() {
  try {
    const tag = sessionStorage.getItem(PENDING_TAG_KEY);
    if (tag === null || tag === "") return false;
    sessionStorage.removeItem(PENDING_TAG_KEY);
    currentTagFilter = tag;
    filterMode = "current";
    if (typeof renderPins === "function") renderPins();
    return true;
  } catch (e) {}
  return false;
}

function tryScrollToPendingPin() {
  try {
    const raw = sessionStorage.getItem(PENDING_SCROLL_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.conversationId !== CHAT_ID) return false;
    const snippet = (data.contentSnippet || "").replace(/\s+/g, " ").trim();
    let target = data.messageId ? document.querySelector(`[data-pinit-id="${data.messageId}"]`) : null;
    if (!target && snippet) {
      const messages = document.querySelectorAll("div[data-message-author-role]");
      for (let i = 0; i < messages.length; i++) {
        const t = (messages[i].textContent || "").replace(/\s+/g, " ").trim();
        if (snippet.length >= 20 && t.indexOf(snippet.slice(0, 80)) !== -1) { target = messages[i]; break; }
        if (snippet.length < 20 && t.indexOf(snippet) !== -1) { target = messages[i]; break; }
      }
    }
    if (target) {
      sessionStorage.removeItem(PENDING_SCROLL_KEY);
      removeLoadingOverlay();
      var p = { messageId: data.messageId || (target.dataset && target.dataset.pinitId) || "" };
      if (data.blockIndex != null) p.blockIndex = data.blockIndex;
      if (data.blockTextHead) p.blockTextHead = data.blockTextHead;
      if (data.contentSnippet) p.content = data.contentSnippet;
      scrollToPinTarget(p);
      return true;
    }
  } catch (e) {}
  return false;
}

// DOM 변경 시 addPinButtons 호출 빈도 제한 (스트리밍·채팅 전환 시 과도한 실행 방지 → 응답 없음 완화)
var addPinButtonsThrottleTimer = null;
var addPinButtonsAfterChatChangeTimer = null;
var lastChatChangeTime = 0;
var ADD_PIN_THROTTLE_MS = 800;
var ADD_PIN_DELAY_AFTER_CHAT_CHANGE_MS = 2200;

function throttledAddPinButtons() {
  if (Date.now() - lastChatChangeTime < ADD_PIN_DELAY_AFTER_CHAT_CHANGE_MS) return;
  if (addPinButtonsThrottleTimer) return;
  addPinButtonsThrottleTimer = setTimeout(function () {
    addPinButtonsThrottleTimer = null;
    addPinButtons();
  }, ADD_PIN_THROTTLE_MS);
}

function scheduleAddPinButtonsAfterChatChange() {
  lastChatChangeTime = Date.now();
  if (addPinButtonsThrottleTimer) { clearTimeout(addPinButtonsThrottleTimer); addPinButtonsThrottleTimer = null; }
  if (addPinButtonsAfterChatChangeTimer) clearTimeout(addPinButtonsAfterChatChangeTimer);
  addPinButtonsAfterChatChangeTimer = setTimeout(function () {
    addPinButtonsAfterChatChangeTimer = null;
    addPinButtons();
  }, ADD_PIN_DELAY_AFTER_CHAT_CHANGE_MS);
}

function observeDOM() { new MutationObserver(throttledAddPinButtons).observe(document.body, { childList: true, subtree: true }); }
function watchChat() {
  setInterval(function () {
    if (getChatId() !== lastChatId) {
      lastChatId = getChatId();
      CHAT_ID = lastChatId;
      renderPins();
      scheduleAddPinButtonsAfterChatChange();
    }
    applyPendingTagFilter();
    tryScrollToPendingPin();
  }, 2000);
}

// 연동 자가검증 (콘솔에서 __pinitgptSelfTest() 호출)
function pinitgptSelfTest() {
  const errors = [];
  const names = getCategoryNames();
  ["starred", "red", "blue", "green", "gold"].forEach(k => {
    if (!(k in names) || !names[k]) errors.push("getCategoryNames missing: " + k);
  });
  const pinBlue = normalizePin({ color: "blue", type: "normal", isStarred: false, conversationId: "c1" });
  const pinContinue = normalizePin({ type: "continue", isContinue: true, isStarred: false, conversationId: "c1" });
  if (!pinBlue.conversationId) errors.push("normalizePin conversationId");
  if (!pinContinue.isContinue) errors.push("normalizePin isContinue");
  const matchFilter = (filter, pin) => (filter === "all") || (filter === "starred" ? pin.isStarred : (filter === "continue" ? pin.isContinue : (pin.color === filter || pin.category === filter)));
  if (!matchFilter("all", pinBlue)) errors.push("filter all");
  if (!matchFilter("blue", pinBlue)) errors.push("filter blue");
  if (matchFilter("red", pinBlue)) errors.push("filter red should exclude blue");
  if (!matchFilter("continue", pinContinue)) errors.push("filter continue");
  if (errors.length) { console.error("pinitgpt self-test FAIL:", errors); return false; }
  console.log(t("self_test_ok"));
  return true;
}
if (typeof window !== "undefined") window.__pinitgptSelfTest = pinitgptSelfTest;

function runInit() {
  loadProState();
  try {
    var raw = sessionStorage.getItem(PENDING_SCROLL_KEY);
    if (raw) {
      var data = JSON.parse(raw);
      if (data.conversationId === CHAT_ID) showLoadingOverlay();
    }
  } catch (e) {}
  createSidebar();
  setupBlockPinDelegation();
  applyPendingTagFilter();
  renderPins();
  observeDOM();
  watchChat();
  var attempts = 0;
  function attempt() {
    applyPendingTagFilter();
    if (tryScrollToPendingPin() || attempts >= 6) {
      if (attempts >= 6) removeLoadingOverlay();
      return;
    }
    attempts++;
    setTimeout(attempt, 800);
  }
  setTimeout(attempt, 500);
}
loadLocale(runInit);
