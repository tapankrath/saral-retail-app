import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import Dashboard from '../screens/Dashboard'
import GoodsInventory from '../screens/GoodsInventory'
import SalesVoucher from '../screens/SalesVoucher'
import SalesReturn from '../screens/SalesReturn'
import PurchaseVoucher from '../screens/PurchaseVoucher'
import PurchaseReturn from '../screens/PurchaseReturn'
import Orders from '../screens/Orders'
import EstimateVoucher from '../screens/EstimateVoucher'
import PaymentReceipt from '../screens/PaymentReceipt'
import StockAdjust from '../screens/StockAdjust'
import Reports from '../screens/Reports'
import AIInsights from '../screens/AIInsights'
import OrgSetup from '../screens/OrgSetup'
import StaffManagement from '../screens/StaffManagement'
import AccountSecurity from '../screens/AccountSecurity'

const NAV_ITEMS = [
  { screen: 'dashboard', label: 'Dashboard', group: null, modules: [] },
  { screen: 'goods', label: 'Goods & Inventory', group: 'Inventory', modules: ['goods_setup'] },
  { screen: 'stock_adjust', label: 'Stock Adjust / Taking', group: 'Inventory', modules: ['stock_adjust', 'stock_taking'] },
  { screen: 'sales', label: 'Sales Voucher', group: 'Sales', modules: ['sales_voucher'] },
  { screen: 'sales_return', label: 'Sales Return', group: 'Sales', modules: ['sales_return'] },
  { screen: 'estimate', label: 'Estimate Voucher', group: 'Sales', modules: ['estimate_voucher'] },
  { screen: 'purchase', label: 'Purchase Voucher', group: 'Purchase', modules: ['purchase_voucher'] },
  { screen: 'purchase_return', label: 'Purchase Return', group: 'Purchase', modules: ['purchase_return'] },
  { screen: 'orders', label: 'Sales / Purchase Orders', group: 'Purchase', modules: ['sales_order', 'purchase_order'] },
  { screen: 'payment_receipt', label: 'Payment / Receipt', group: 'Finance', modules: ['payment_voucher', 'receipt_voucher'] },
  { screen: 'reports', label: 'Reports', group: 'Reports', modules: ['reports'] },
  { screen: 'ai_insights', label: 'AI Insights', group: 'Reports', modules: ['reports'] },
  { screen: 'org_setup', label: 'Organization & Branch', group: 'Setup', modules: ['system_setup', 'branch_setup'] },
  { screen: 'staff', label: 'Users & Staff', group: 'Setup', modules: ['user_staff'] },
  { screen: 'account_security', label: 'Account & Security', group: 'Setup', modules: [] },
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
          {screen === 'sales_return' && <SalesReturn />}
          {screen === 'estimate' && <EstimateVoucher />}
          {screen === 'purchase' && <PurchaseVoucher />}
          {screen === 'purchase_return' && <PurchaseReturn />}
          {screen === 'orders' && <Orders />}
          {screen === 'payment_receipt' && <PaymentReceipt />}
          {screen === 'reports' && <Reports />}
          {screen === 'ai_insights' && <AIInsights />}
          {screen === 'org_setup' && <OrgSetup />}
          {screen === 'staff' && <StaffManagement />}
          {screen === 'account_security' && <AccountSecurity />}
        </div>
      </div>
    </div>
  )
}
