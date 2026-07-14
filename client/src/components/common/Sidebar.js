import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo2.png'

const navConfig = {
  super_admin: [
    { section: 'Dashboard', links: [
      { icon: '📊', label: 'Overview', path: '/' },
      { icon: '📈', label: 'Sales Reports', path: '/reports' },
      { icon: '📦', label: 'Stock Overview', path: '/stock-overview' },
    ]},
    { section: 'Management', links: [
      { icon: '✂️', label: 'Specialists', path: '/specialists' },
      { icon: '💆', label: 'Services', path: '/services' },
      { icon: '🧴', label: 'Products', path: '/products' },
      { icon: '👥', label: 'Customers', path: '/customers' },
      { icon: '📅', label: 'Appointments', path: '/appointments' },
      { icon: '🎫', label: 'Membership', path: '/membership' },
      { icon: '⭐', label: 'Loyalty Points', path: '/loyalty' },
      { icon: '🎉', label: 'Festival Offers', path: '/offers' },
    ]},
    { section: 'System', links: [
      { icon: '👤', label: 'Users', path: '/users' },
    ]},
  ],
  receptionist: [
    { section: 'Main', links: [
      { icon: '📅', label: 'Appointments', path: '/appointments' },
      { icon: '👥', label: 'Customers', path: '/customers' },
    ]},
  ],
  stockist: [
    { section: 'Inventory', links: [
      { icon: '🧴', label: 'Products', path: '/products' },
      { icon: '📦', label: 'Stock Overview', path: '/stock-overview' },
    ]},
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const links = navConfig[user.role] || [];

  const roleLabel = {
    super_admin: 'Super Admin',
    receptionist: 'Receptionist',
    stockist: 'Stockist',
  }[user.role];

  return (
    <div className="sidebar" style={{ textAlign: 'center' }}>
      <div className="sidebar-logo"><img src={logo} alt="J Eighteen Beauty Salon Academy" style={{ height:73, marginRight:12 }} />
        <h1></h1>
        <div><span>J Eighteen Beauty Salon Academy</span></div>
      </div>

      {/* Public booking link */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a
          href="/appointment"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            color: 'white', borderRadius: 8, padding: '8px 12px',
            fontSize: 12, fontWeight: 600, textDecoration: 'none'
          }}
        >
          🔗 Customer Booking Page ↗
        </a>
      </div>

      <nav className="sidebar-nav">
        {links.map(section => (
          <div className="nav-section" key={section.section}>
            <div className="nav-section-title">{section.section}</div>
            {section.links.map(link => (
              <button
                key={link.path}
                className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={() => navigate(link.path)}
              >
                <span className="icon">{link.icon}</span>
                {link.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-name">{user.name}</div>
        <div className="user-role">{roleLabel}</div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
          style={{ marginTop: 12, width: '100%' }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
