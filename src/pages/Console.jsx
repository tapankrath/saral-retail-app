import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import Dashboard from '../screens/Dashboard'
import GoodsInventory from '../screens/GoodsInventory'
import SalesVoucher from '../screens/SalesVoucher'
import PurchaseVoucher from '../screens/PurchaseVoucher'
import PaymentReceipt from '../screens/PaymentReceipt'
import StockAdjust from '../screens/StockAdjust'
import Reports from '../screens/Reports'
import AIInsights from '../screens/AIInsights'

const NAV_ITEMS = [
  { screen: 'dashboard', label: 'Dashboard', group: null, modules: [] },
  { screen: 'goods', label: 'Goods & Inventory', group: 'Inventory', modules: ['goods_setup'] },
  { screen: 'stock_adjust', label: 'Stock Adjust', group: 'Inventory', modules: ['stock_adjust'] },
  { screen: 'sales', label: 'Sales Voucher', group: 'Finance', modules: ['sales_voucher'] },
  { screen: 'purchase', label: 'Purchase Voucher', group: 'Finance', modules: ['purchase_voucher'] },
  { screen: 'payment_receipt', label: 'Payment / Receipt', group: 'Finance', modules: ['payment_voucher', 'receipt_voucher'] },
  { screen: 'reports', label: 'Reports', group: 'Reports', modules: ['reports'] },
  { screen: 'ai_insights', label: 'AI Insights', group: 'Reports', modules: ['reports'] },
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

  function visible(item) {
    return item.modules.length === 0 || item.modules.some((m) => canView(m))
  }

  const visibleItems = NAV_ITEMS.filter(visible)
  const navRows = visibleItems.map((item, i) => ({
    item,
    showGroupLabel: item.group && item.group !== visibleItems[i - 1]?.group,
  }))

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
          {navRows.map(({ item, showGroupLabel }) => (
            <div key={item.screen}>
              {showGroupLabel && <div className="nav-grp-label">{item.group}</div>}
              <button
                className={`nav-item${screen === item.screen ? ' active' : ''}`}
                onClick={() => {
                  setScreen(item.screen)
                  setSidebarOpen(false)
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
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
          {screen === 'stock_adjust' && <StockAdjust />}
          {screen === 'sales' && <SalesVoucher />}
          {screen === 'purchase' && <PurchaseVoucher />}
          {screen === 'payment_receipt' && <PaymentReceipt />}
          {screen === 'reports' && <Reports />}
          {screen === 'ai_insights' && <AIInsights />}
        </div>
      </div>
    </div>
  )
}
