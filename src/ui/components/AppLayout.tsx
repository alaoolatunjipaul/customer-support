import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar isOpen={navOpen} onClose={() => setNavOpen(false)} />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className="topbar__menu-icon" aria-hidden="true" />
          </button>
          <div className="topbar__title">
            <span className="topbar__eyebrow">AI-assisted customer support — human reviewed</span>
            <span className="topbar__status" role="status" title="This demo never connects to real systems or real data">
              Demo environment • Synthetic data
            </span>
          </div>
          <div className="topbar__right">
            <span className="topbar__mock" title="AI runs in deterministic mock mode (no API key, no real LLM calls)">
              AI: mock
            </span>
            <span className="topbar__agent-chip">Demo Agent</span>
          </div>
        </header>

        <main id="main-content" className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}