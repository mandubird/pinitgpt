# pinitgpt Conversion Optimization Spec
Version: 1.1 (v6.1)

Purpose: Improve Pro conversion without breaking existing functionality

---

# 1. Critical Rule (VERY IMPORTANT)

This update must NOT break or remove any existing functionality.

Mandatory rules:

1. Do NOT delete any existing features
2. Do NOT modify existing pin logic behavior
3. Do NOT modify storage data format
4. Do NOT remove any existing UI component
5. Do NOT change current free limits (1 chat, 5 pins)
6. Do NOT break existing Pro licensing logic
7. All new features must be additive

This update is strictly conversion optimization only.

---

# 2. Current Product Context

Extension name:

pinitgpt

Purpose:

Pin important ChatGPT messages and quickly navigate back to them

Core functionality:

- Pin messages
- View pinned items in sidebar
- Jump to pinned message
- Tag organization
- Local storage

Free plan:

- 1 chat
- 5 pins

Pro plan:

- Unlimited chats
- Unlimited pins
- Global search
- Tags
- Export
- Important marker
- Continue mode

---

# 3. Current Problem

Analytics snapshot:

- 59 installs
- 15 Gumroad visits
- 0 purchases

Meaning:

Users show interest but do not convert.

Likely causes:

1. Free plan is comfortable enough for light users
2. Pro value is not visible at decision moments
3. Upgrade triggers are weak or poorly timed
4. Gumroad entry point visibility is low

Primary goal:

Increase conversion from interested users without harming retention.

---

# 4. Feature 1 — Limit Reached Upgrade Modal

Trigger:

When user attempts to create the 6th pin.

Condition:

pin_count >= 5

Behavior:

Instead of silent block, show upgrade modal.

Modal copy:

Title:
You've reached the free limit

Message:
Free version allows up to 5 pins in 1 chat.
Upgrade to Pro to unlock unlimited pins and stronger organization tools.

Feature list:

- Unlimited pins
- Global search
- Tag filtering
- Export pins (CSV / Markdown)
- Continue view mode

Buttons:

Primary: Upgrade to Pro
Secondary: Continue with free version

Primary action URL:

https://remoney.gumroad.com/l/pinitgpt

Tracking:

Emit click_upgrade with source=limit_modal.

---

# 5. Feature 2 — Pro Feature Lock Indicators

Current issue:

Pro features are often hidden, so users do not understand value.

Update:

Show Pro features in disabled/locked state.

Examples:

- Search (Pro) lock icon
- Export (Pro) lock icon
- Advanced tag actions (Pro) lock icon

Click behavior:

Show lightweight upgrade prompt (not full-screen blocking).

Prompt copy:

This feature is available in Pro.

CTA:

Upgrade to Pro

Tracking:

Emit click_upgrade with source mapped by entry point.

---

# 6. Feature 3 — Sidebar Upgrade Banner

Placement:

Bottom section of sidebar.

Copy:

Unlock unlimited pins and powerful search.

Button:

Upgrade

Action:

Open Gumroad purchase page.

Tracking:

Emit click_upgrade with source=sidebar_banner.

---

# 7. Feature 4 — First Pin Success Moment (Adjusted Rule)

Important conflict resolution:

First pin event must NOT show an upgrade push CTA.

Allowed behavior after first successful pin:

Show a neutral success toast only.

Recommended copy:

Pinned successfully.
You can save up to 5 pins in free.

Do NOT include direct upgrade button in this first-pin toast.

Reason:

Avoid early pressure and align with prompt timing rules.

---

# 8. Feature 5 — Gumroad Tracking

Core event:

click_upgrade

Emit click_upgrade at all upgrade entry points:

- limit modal primary CTA
- sidebar banner CTA
- lock prompt CTA
- any settings upgrade CTA

Payload standard:

```js
dataLayer.push({
  event: "click_upgrade",
  source: "sidebar_banner"
});
```

Optional secondary event:

click_gumroad

Use only if needed for direct outbound measurement. If used, keep source consistent.

---

# 9. Feature 6 — Gumroad Page Improvements

Gumroad content additions:

- Why Pro section
- Clear use-case bullets (developer/researcher/writer/student)
- Free vs Pro comparison table

Comparison table baseline:

Feature | Free | Pro
------- | ---- | ----
Pins | 5 | Unlimited
Chats | 1 | Unlimited
Search | No | Yes
Tags | No | Yes
Export | No | Yes
Continue mode | No | Yes

---

# 10. Feature 7 — Upgrade Prompt Timing (With Cooldown)

Show upgrade prompts when:

- 5-pin limit reached
- locked feature clicked
- search attempted while locked
- export attempted while locked

Do NOT show when:

- immediately after install
- immediately after first pin

Mandatory anti-spam rule:

Apply prompt cooldown using local key.

Suggested key:

pinitgpt_upgrade_prompt_last_ts

Suggested window:

10 to 15 minutes between prompts.

If within cooldown, skip showing modal/toast and do not interrupt workflow.

---

# 11. UI Design Guidelines

Upgrade UI must be:

- minimal
- non-intrusive
- dark-mode compatible
- visually consistent with existing design

Avoid:

- aggressive popups
- full-screen hard block
- repeated spam prompts

---

# 12. Data Safety Requirements

Do NOT modify:

- existing pin storage keys
- local storage pin format
- chatId structure
- pin data schema

All existing user data must remain fully compatible.

New keys may be added only for additive conversion logic, for example:

- pinitgpt_upgrade_prompt_last_ts
- pinitgpt_upgrade_prompt_seen_count

---

# 13. Code Structure Requirements (Practical)

Preferred:

Isolate new conversion logic into focused functions/modules.

Examples:

- upgradePrompt.ts / upgradePrompt.js
- tracking.ts / tracking.js
- upgradeUi.ts / upgradeUi.js

Practical rule for current codebase:

If full physical module split is too risky, keep minimal edits in core file and extract helper functions first.

Do NOT rewrite core pin system for this update.

---

# 14. QA Requirements

Before release, verify:

- pin creation still works
- existing pins load correctly
- sidebar interactions unchanged
- scroll-to-pin still works
- local storage data remains intact
- prompt cooldown works (no spam)

Test cases:

1. Pin 1 message (no upgrade CTA pressure)
2. Pin up to 5 messages
3. Attempt 6th pin (limit modal appears)
4. Click upgrade CTA (event emitted)
5. Click locked search/export (prompt appears + event)
6. Trigger prompt twice within cooldown (second prompt suppressed)

---

# 15. Success Metrics (2-Phase)

Phase 1 (immediate, reliable):

- limit_reached
- click_upgrade
- click_gumroad (if enabled)
- pin_created

Primary KPI:

click_upgrade / limit_reached

Secondary KPI:

gumroad_visit / click_upgrade

Phase 2 (after reliable purchase instrumentation):

- purchase

Then measure full funnel:

limit_reached -> click_upgrade -> gumroad_visit -> purchase

Targets (initial):

- click_upgrade rate from limit reached > 30%
- purchase conversion from gumroad visit > 2%

---

# 16. Deployment Notes

This update must:

- NOT affect extension permissions
- NOT significantly increase extension bundle size
- NOT degrade ChatGPT page responsiveness
- include rollback-safe changes only

---

# 17. Version

Release target:

v1.0.5

Changelog summary:

- Added additive upgrade visibility at decision moments
- Added standardized click_upgrade tracking with source
- Added anti-spam cooldown policy
- Resolved first-pin prompt conflict
- Kept existing core pin behavior unchanged

---

# 18. Final Rule

Existing functionality must remain unchanged.

All updates must be additive, measurable, and reversible.
