'use client';

import { useCallback, useEffect } from "react";

const CWS_URL =
  process.env.NEXT_PUBLIC_CWS_URL ||
  "https://chromewebstore.google.com/detail/pinitgpt/pkohflhmjcffmgddalejheoeibaopibo";

const FEEDBACK_URL = "https://forms.gle/DD5FCpq11asY4rqa9";

function trackEvent(name: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.gtag === "function") {
    w.gtag("event", name, params || {});
  }
}

export default function HomePage() {
  useEffect(() => {
    let fired = false;
    function onScroll() {
      if (fired) return;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const viewport = window.innerHeight;
      const fullHeight = doc.scrollHeight;
      if (fullHeight <= viewport) return;
      const ratio = (scrollTop + viewport) / fullHeight;
      if (ratio >= 0.75) {
        fired = true;
        trackEvent("scroll_75");
      }
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleInstallClick = useCallback(() => {
    trackEvent("click_install", { source: "hero_button" });
    if (typeof window !== "undefined") {
      window.open(CWS_URL, "_blank");
    }
  }, []);

  const handleFooterInstallClick = useCallback(() => {
    trackEvent("click_install", { source: "footer_cta" });
    if (typeof window !== "undefined") {
      window.open(CWS_URL, "_blank");
    }
  }, []);

  const handleFeedbackClick = useCallback(() => {
    trackEvent("feedback_click", { source: "landing_footer" });
  }, []);

  return (
    <main className="page">
      <div className="container">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <div className="badge">
                <span>📌 pinitgpt</span>
                <span>Pin & reuse your best ChatGPT prompts</span>
              </div>
              <h1 className="headline">
                Organize ChatGPT. <span className="accent">Reuse prompts.</span> Save hours every
                week.
              </h1>
              <p className="subcopy">
                Stop losing your best AI workflows. Capture important chats in one sidebar, search
                them later, and continue where you left off.
              </p>
              <div className="cta-row">
                <button type="button" className="btn-primary" onClick={handleInstallClick}>
                  <span>Install Free</span>
                  <span>→</span>
                </button>
                <div className="cta-note">No account required. Chrome extension.</div>
              </div>
            </div>
            <div>
              <div className="hero-card">
                <div className="hero-card-title">Pin your best AI workflows</div>
                <div className="hero-card-row">
                  <div className="hero-card-label">Pain</div>
                  <div>
                    ❌ You lose important prompts
                    <br />
                    ❌ You rewrite the same instructions
                    <br />
                    ❌ Your workflow is scattered and messy
                  </div>
                </div>
                <div className="hero-card-row">
                  <div className="hero-card-label">Fix</div>
                  <div>
                    📌 Pin key messages directly in ChatGPT
                    <br />
                    📂 Organize by project, tag, or status
                    <br />
                    🔍 Search & continue conversations later
                  </div>
                </div>
                <div className="hero-code">
                  <div style={{ marginBottom: 4, color: "#e5e7eb" }}>
                    Track which channels convert:
                  </div>
                  <code>
                    gtag('event', 'click_install', &#123;
                    <br />
                    &nbsp;&nbsp;source: 'hero_button'
                    <br />
                    &#125;);
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Stop losing high-signal conversations</h2>
          <p className="section-sub">Three problems pinitgpt quietly solves for you:</p>
          <div className="pain-list">
            <div>❌ You lose important prompts</div>
            <div>❌ You rewrite the same instructions over and over</div>
            <div>❌ Your AI workflow is scattered and messy</div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Pin, organize, and continue in seconds</h2>
          <p className="section-sub">
            Lightweight sidebar inside ChatGPT — built for people who live in prompts every day.
          </p>
          <div className="demo-grid">
            <div className="demo-card">
              <div className="demo-tag">
                <span>Demo 1</span>
                <span>📌 Pin from the chat</span>
              </div>
              <div className="demo-screen">
                <div style={{ marginBottom: 8 }}>Hover a message to reveal the Pin button.</div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        borderRadius: 10,
                        background: "#020617",
                        border: "1px solid rgba(148,163,184,0.35)",
                        padding: "10px 12px",
                        fontSize: 11,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ opacity: 0.5, marginRight: 6 }}>You</span>
                      "Summarize this 40-page report into 3 bullet points"
                      <span style={{ float: "right" }}>📌</span>
                    </div>
                    <div
                      style={{
                        borderRadius: 10,
                        background: "#020617",
                        border: "1px solid rgba(31,41,55,0.8)",
                        padding: "10px 12px",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ opacity: 0.5, marginRight: 6 }}>ChatGPT</span>
                      "Here are the 3 key takeaways..."
                    </div>
                  </div>
                  <div className="demo-sidebar">
                    <div className="demo-sidebar-header">📌 pinitgpt</div>
                    <div className="demo-sidebar-pin">
                      <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2 }}>Weekly report</div>
                      <div>"Summarize this 40-page report..."</div>
                    </div>
                    <div className="demo-sidebar-pin">
                      <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2 }}>Client A</div>
                      <div>"Rewrite this email in a friendly tone"</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="demo-card">
              <div className="demo-tag">
                <span>Demo 2</span>
                <span>📂 Sidebar organization</span>
              </div>
              <div className="demo-screen">
                <div>See all your pinned chats in one place.</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div className="pill">🔵 In progress</div>
                    <div className="pill" style={{ marginTop: 6 }}>
                      🟢 Review later
                    </div>
                    <div className="pill" style={{ marginTop: 6 }}>
                      🟡 Reference
                    </div>
                  </div>
                  <div style={{ flex: 2 }}>
                    <div className="demo-sidebar-pin">
                      <div style={{ fontSize: 10, opacity: 0.8 }}>🔵 Dev — Refactor</div>
                      <div>"Refactor this function step-by-step"</div>
                    </div>
                    <div className="demo-sidebar-pin">
                      <div style={{ fontSize: 10, opacity: 0.8 }}>🟢 Study notes</div>
                      <div>"Explain this concept like I'm 12"</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Built for builders, not enterprises</h2>
          <div className="social-proof-grid">
            <div className="social-proof-item">
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Early usage</div>
              <div>30+ early users</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Tracking how people actually use it before going bigger.
              </div>
            </div>
            <div className="social-proof-item">
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Indie-friendly</div>
              <div>Built by a solo indie maker</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Opinionated, lightweight, no bloated dashboards.
              </div>
            </div>
            <div className="social-proof-item">
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Privacy</div>
              <div>No account required</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Your chats stay in ChatGPT. pinitgpt only pins what you choose.
              </div>
            </div>
          </div>
        </section>

        <section className="footer-cta">
          <div className="footer-cta-main">
            <div className="footer-cta-title">Start organizing ChatGPT now.</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Pin your next 10 high-signal conversations and see what sticks.
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={handleFooterInstallClick}>
            <span>Install Free</span>
            <span>→</span>
          </button>
        </section>

        <div className="footer-links" style={{ marginTop: 10 }}>
          <a href="/privacy" className="footer-link">
            Privacy
          </a>
          <a href="/terms" className="footer-link">
            Terms
          </a>
          <a
            href={https://forms.gle/78g5g7osQefrBqp26}
            target="_blank"
            rel="noopener"
            className="feedback-link"
            onClick={handleFeedbackClick}
          >
            <span>💬 Help improve (1 min)</span>
          </a>
        </div>
      </div>
    </main>
  );
}

