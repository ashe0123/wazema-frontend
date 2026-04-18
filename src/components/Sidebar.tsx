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
}

export default function Sidebar({ active, onSelect, items, role, badge }: Props) {
  const router = useRouter();
  const user = getUser();

  function logout() {
    clearSession();
    router.push('/');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-name">W<span>A</span>ZEMA</div>
        <div className="brand-sub">Saving and Credit Basic Cooperative</div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.section}
            className={`nav-item${active === item.section ? ' active' : ''}`}
            onClick={() => onSelect(item.section)}
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
  );
}
