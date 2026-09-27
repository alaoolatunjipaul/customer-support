import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/customers', label: 'Customers' },
  { to: '/audit', label: 'Audit log' },
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside id="app-sidebar" className={`sidebar ${isOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark" aria-hidden="true">
            CS
          </span>
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">Customer Support Copilot</span>
            <span className="sidebar__tagline">AI-assisted customer support — human reviewed</span>
          </div>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__section-label">Workspace</p>
          <ul className="sidebar__links">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar__agent">
          <div className="sidebar__agent-avatar" aria-hidden="true">
            DA
          </div>
          <div className="sidebar__agent-text">
            <p className="sidebar__agent-name">Demo Agent</p>
            <p className="sidebar__agent-role">Support agent · synthetic session</p>
            <p className="sidebar__env">Demo Environment • Synthetic Data • No CRM Connection</p>
            <p className="sidebar__note">Ephemeral demo state — persistent storage required for production.</p>
          </div>
        </div>
      </aside>
    </>
  );
}