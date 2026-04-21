'use client';
import { clearSession, getUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface NavItem { icon: string; label: string; section: string; }

interface Props {
  active: string;
  onSelect: (s: string) => void;
  items: NavItem[];
  role: 'admin' | 'member';
  badge?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ active, onSelect, items, role, badge, mobileOpen, onMobileClose }: Props) {
  const router = useRouter();
  const user = getUser();

  function logout() {
    clearSession();
    router.push('/');
  }

  function handleSelect(section: string) {
    onSelect(section);
    if (onMobileClose) onMobileClose(); // Close sidebar on mobile after selection
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}
      <aside className={`sidebar${mobileOpen ? ' sidebar-mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-name">W<span>A</span>ZEMA</div>
        <div className="brand-sub">Saving and Credit Basic Cooperative</div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.section}
            className={`nav-item${active === item.section ? ' active' : ''}`}
            onClick={() => handleSelect(item.section)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          {role === 'admin' ? '🔐 Administrator' : `👤 ${user?.name || 'Member'}`}
        </div>
        <button className="btn btn-ghost btn-sm btn-full" onClick={logout}>Sign Out</button>
      </div>
    </aside>
    </>
  );
}
