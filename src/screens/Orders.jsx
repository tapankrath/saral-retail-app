import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Orders() {
  const { profile, canAdd, canEdit } = useAuth()
  const canSales = canAdd('sales_order')
  const canPurchase = canAdd('purchase_order')
  const [mode, setMode] = useState(canSales ? 'sales' : 'purchase')
  const [accounts, setAccounts] = useState([])
  const [goods, setGoods] = useState([])
  const [accountId, setAccountId] = useState('')
  const [goodsQuery, setGoodsQuery] = useState('')
  const [lines, setLines] = useState([])
  const [narration, setNarration] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [recent, setRecent] = useState([])

  async function loadAccounts(txnType) {
    const { data: acctRows } = await supabase
      .from('accounts')
      .select('id, name, account_groups(transaction_type)')
      .is('system_role', null)
      .order('name')
    setAccounts((acctRows ?? []).filter((a) => a.account_groups?.transaction_type === txnType))
  }

  async function loadRecent() {
    if (mode === 'sales') {
      const { data } = await supabase
        .from('sales_orders')
        .select('id, voucher_no, voucher_date, total, status, accounts(name)')
        .order('created_at', { ascending: false })
        .limit(15)
      setRecent(data ?? [])
    } else {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, voucher_no, voucher_date, total, status, accounts(name)')
        .order('created_at', { ascending: false })
        .limit(15)
      setRecent(data ?? [])
    }
  }

  useEffect(() => {
    loadAccounts(mode === 'sales' ? 'assets' : 'liabilities')
    loadRecent()
    setAccountId('')
    setLines([])
    setResult(null)
    setError(null)
    async function load() {
      const { data: goodsRows } = await supabase.from('goods_with_stock').select('*').order('goods_name')
      setGoods(goodsRows ?? [])
    }
    load()
  }, [mode])

  const goodsMatches = useMemo(() => {
    if (!goodsQuery) return []
    return goods.filter((g) => g.goods_name.toLowerCase().includes(goodsQuery.toLowerCase())).slice(0, 6)
  }, [goodsQuery, goods])

  function addLine(g) {
    setLines((prev) => [...prev, { lot_id: g.lot_id, goods_name: g.goods_name, rate: Number(mode === 'sales' ? g.mrp : g.lot_value) || 0, qty: 1 }])
    setGoodsQuery('')
  }
  function updateLine(idx, field, value) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }
  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }
  const computed = lines.map((l) => ({ ...l, total: Number(l.rate) * Number(l.qty || 0) }))
  const grandTotal = computed.reduce((s, l) => s + l.total, 0)

  async function handleSubmit() {
    setError(null)
    setResult(null)
    if (!accountId) {
      setError(`Pick a ${mode === 'sales' ? 'customer' : 'supplier'} first.`)
      return
    }
    if (lines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    setSubmitting(true)
    const fn = mode === 'sales' ? 'create_sales_order' : 'create_purchase_order'
    const { data, error } = await supabase.rpc(fn, {
      p_branch_id: profile.home_branch_id,
      p_voucher_date: new Date().toISOString().slice(0, 10),
      p_account_id: accountId,
      p_lines: lines.map((l) => ({ lot_id: l.lot_id, rate: Number(l.rate), qty: Number(l.qty) })),
      p_narration: narration || null,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    setResult(row)
    setLines([])
    setAccountId('')
    setNarration('')
    await loadRecent()
  }

  async function setStatus(orderId, status) {
    const { error } = await supabase.rpc('update_order_status', { p_order_type: mode, p_order_id: orderId, p_status: status })
    if (!error) await loadRecent()
  }

  if (!canSales && !canPurchase) {
    return (
      <section>
        <div className="page-head"><h1>Orders</h1></div>
        <p className="empty-note">Your account doesn't have permission to create orders.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{mode === 'sales' ? 'Sales Order' : 'Purchase Order'}</h1>
          <p className="sub">Records intent without touching stock or the ledger — convert it to a voucher once it's fulfilled</p>
        </div>
      </div>

      <div className="tab-row">
        {canSales && <button className={`tab${mode === 'sales' ? ' active' : ''}`} onClick={() => setMode('sales')}>Sales Order</button>}
        {canPurchase && <button className={`tab${mode === 'purchase' ? ' active' : ''}`} onClick={() => setMode('purchase')}>Purchase Order</button>}
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          Order <strong>{result.voucher_no}</strong> saved.
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="voucher-head-grid">
        <div className="field" style={{ marginTop: 0 }}>
          <label>{mode === 'sales' ? 'Customer' : 'Supplier'}</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Select…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Narration (optional)</label>
          <input value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
      </div>

      <div className="voucher-grid">
        <div>
          <div className="line-toolbar">
            <div className="search-box" style={{ maxWidth: '100%', flex: 1 }}>
              <input placeholder="Search goods to add a line" value={goodsQuery} onChange={(e) => setGoodsQuery(e.target.value)} />
            </div>
          </div>
          {goodsMatches.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table className="data">
                <tbody>
                  {goodsMatches.map((g) => (
                    <tr key={g.lot_id} onClick={() => addLine(g)} style={{ cursor: 'pointer' }}>
                      <td className="strong">{g.goods_name}</td>
                      <td className="num">{g.current_qty} {g.uom} in stock</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Goods</th><th>Rate</th><th>Qty</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {computed.map((l, idx) => (
                  <tr key={idx}>
                    <td className="strong">{l.goods_name}</td>
                    <td className="num"><input style={{ width: 80, font: 'inherit' }} type="number" value={l.rate} onChange={(e) => updateLine(idx, 'rate', e.target.value)} /></td>
                    <td className="num"><input style={{ width: 60, font: 'inherit' }} type="number" value={l.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} /></td>
                    <td className="num">₹{money(l.total)}</td>
                    <td><button className="icon-btn" onClick={() => removeLine(idx)} aria-label="Remove">✕</button></td>
                  </tr>
                ))}
                {computed.length === 0 && (
                  <tr><td colSpan={5} className="empty-note">Search above and click a result to add it.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Order summary</h3>
          <div className="summary-row total"><span>Total</span><span className="val tnum">₹{money(grandTotal)}</span></div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Order'}
          </button>
        </div>
      </div>

      <h3 style={{ margin: '24px 0 10px' }}>Recent {mode === 'sales' ? 'sales' : 'purchase'} orders</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Voucher</th><th>Date</th><th>{mode === 'sales' ? 'Customer' : 'Supplier'}</th><th>Total</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id}>
                <td className="strong">{o.voucher_no}</td>
                <td>{o.voucher_date}</td>
                <td>{o.accounts?.name ?? '—'}</td>
                <td className="num">₹{money(o.total)}</td>
                <td><span className={`chip ${o.status === 'completed' ? 'ok' : o.status === 'cancelled' ? 'out' : 'low'}`}>{o.status}</span></td>
                <td>
                  {canEdit(mode === 'sales' ? 'sales_order' : 'purchase_order') && o.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '.75rem' }} onClick={() => setStatus(o.id, 'completed')}>Complete</button>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '.75rem' }} onClick={() => setStatus(o.id, 'cancelled')}>Cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={6} className="empty-note">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
