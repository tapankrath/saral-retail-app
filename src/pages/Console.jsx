import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import Dashboard from '../screens/Dashboard'
import GoodsInventory from '../screens/GoodsInventory'
import SalesVoucher from '../screens/SalesVoucher'

const NAV_ITEMS = [
  { screen: 'dashboard', label: 'Dashboard', group: null, module: null },
  { screen: 'goods', label: 'Goods & Inventory', group: 'Inventory', module: 'goods_setup' },
  { screen: 'sales', label: 'Sales Voucher', group: 'Finance', module: 'sales_voucher' },
]

export default function Console() {
  const { profile, logout, canView } = useAuth()
  const [screen, setScreen] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const initials = (profile?.full_name || profile?.login_name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="lockup">
            <span className="word">Saral</span>
            <span className="caption">Retail · Console</span>
          </div>
          <button className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            ×
          </button>
        </div>

        <nav className="sidenav">
          {NAV_ITEMS.map((item) => {
            if (item.module && !canView(item.module)) return null
            return (
              <button
                key={item.screen}
                className={`nav-item${screen === item.screen ? ' active' : ''}`}
                onClick={() => {
                  setScreen(item.screen)
                  setSidebarOpen(false)
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <p className="hint">Signed in as {profile?.full_name} ({profile?.login_name}@{profile?.organizations?.short_code})</p>
          <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="backdrop open" onClick={() => setSidebarOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <div className="scope-pick">
            <span className="label">{profile?.branches?.name ?? '—'}</span>
          </div>
          <div className="topbar-right">
            <div className="user-chip">
              <span className="avatar">{initials}</span>
              <div className="who">
                <div className="name">{profile?.full_name}</div>
                <div className="role">{profile?.is_owner ? 'Owner' : profile?.designation}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'goods' && <GoodsInventory />}
          {screen === 'sales' && <SalesVoucher />}
        </div>
      </div>
    </div>
  )
}
