import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EstimateVoucher() {
  const { profile, canAdd } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [goods, setGoods] = useState([])
  const [accountId, setAccountId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [goodsQuery, setGoodsQuery] = useState('')
  const [lines, setLines] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [recent, setRecent] = useState([])

  async function loadRecent() {
    const { data } = await supabase
      .from('estimate_vouchers')
      .select('id, voucher_no, voucher_date, total, customer_name, accounts(name)')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecent(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const { data: acctRows } = await supabase
        .from('accounts')
        .select('id, name, account_groups(transaction_type)')
        .is('system_role', null)
        .order('name')
      setAccounts((acctRows ?? []).filter((a) => a.account_groups?.transaction_type === 'assets'))
      const { data: goodsRows } = await supabase.from('goods_with_stock').select('*').order('goods_name')
      setGoods(goodsRows ?? [])
      await loadRecent()
    }
    load()
  }, [])

  const goodsMatches = useMemo(() => {
    if (!goodsQuery) return []
    return goods.filter((g) => g.goods_name.toLowerCase().includes(goodsQuery.toLowerCase())).slice(0, 6)
  }, [goodsQuery, goods])

  function addLine(g) {
    setLines((prev) => [...prev, { lot_id: g.lot_id, goods_name: g.goods_name, mrp: Number(g.mrp), rate: Number(g.mrp), tax_pct: Number(g.tax_percent ?? 0), qty: 1 }])
    setGoodsQuery('')
  }
  function updateLine(idx, field, value) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }
  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const computed = lines.map((l) => {
    const goodsValue = Number(l.rate) * Number(l.qty || 0)
    const taxValue = (goodsValue * Number(l.tax_pct || 0)) / 100
    return { ...l, goodsValue, taxValue, total: goodsValue + taxValue }
  })
  const totalGoods = computed.reduce((s, l) => s + l.goodsValue, 0)
  const totalTax = computed.reduce((s, l) => s + l.taxValue, 0)
  const grandTotal = totalGoods + totalTax

  async function handleSubmit() {
    setError(null)
    setResult(null)
    if (lines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('create_estimate_voucher', {
      p_branch_id: profile.home_branch_id,
      p_voucher_date: new Date().toISOString().slice(0, 10),
      p_account_id: accountId || null,
      p_lines: lines.map((l) => ({ lot_id: l.lot_id, mrp: l.mrp, tax_pct: l.tax_pct, rate: Number(l.rate), qty: Number(l.qty) })),
      p_customer_name: customerName || null,
      p_mobile: mobile || null,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    setResult(row)
    setLines([])
    setCustomerName('')
    setMobile('')
    await loadRecent()
  }

  if (!canAdd('estimate_voucher')) {
    return (
      <section>
        <div className="page-head"><h1>Estimate Voucher</h1></div>
        <p className="empty-note">Your account doesn't have permission to create estimates.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Estimate Voucher</h1>
          <p className="sub">A price quote for a customer — doesn't touch stock or the ledger until it becomes a real sale</p>
        </div>
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          Estimate <strong>{result.voucher_no}</strong> saved.
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="voucher-head-grid">
        <div className="field" style={{ marginTop: 0 }}>
          <label>Existing customer (optional)</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Walk-in / not on file</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Customer name</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Walk-in customer" />
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Mobile (optional)</label>
          <input value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
      </div>

      <div className="voucher-grid">
        <div>
          <div className="line-toolbar">
            <div className="search-box" style={{ maxWidth: '100%', flex: 1 }}>
              <input placeholder="Search goods to quote" value={goodsQuery} onChange={(e) => setGoodsQuery(e.target.value)} />
            </div>
          </div>
          {goodsMatches.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table className="data">
                <tbody>
                  {goodsMatches.map((g) => (
                    <tr key={g.lot_id} onClick={() => addLine(g)} style={{ cursor: 'pointer' }}>
                      <td className="strong">{g.goods_name}</td>
                      <td className="num">₹{money(g.mrp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Goods</th><th>Rate</th><th>Qty</th><th>Tax%</th><th>Total</th><th></th></tr>
              </thead>
              <tbody>
                {computed.map((l, idx) => (
                  <tr key={idx}>
                    <td className="strong">{l.goods_name}</td>
                    <td className="num"><input style={{ width: 80, font: 'inherit' }} type="number" value={l.rate} onChange={(e) => updateLine(idx, 'rate', e.target.value)} /></td>
                    <td className="num"><input style={{ width: 60, font: 'inherit' }} type="number" value={l.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} /></td>
                    <td className="num">{l.tax_pct}%</td>
                    <td className="num">₹{money(l.total)}</td>
                    <td><button className="icon-btn" onClick={() => removeLine(idx)} aria-label="Remove">✕</button></td>
                  </tr>
                ))}
                {computed.length === 0 && (
                  <tr><td colSpan={6} className="empty-note">Search above and click a result to add it.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Estimate summary</h3>
          <div className="summary-row"><span>Goods value</span><span className="tnum">₹{money(totalGoods)}</span></div>
          <div className="summary-row"><span>Tax</span><span className="tnum">₹{money(totalTax)}</span></div>
          <div className="summary-row total"><span>Total</span><span className="val tnum">₹{money(grandTotal)}</span></div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Estimate'}
          </button>
        </div>
      </div>

      <h3 style={{ margin: '24px 0 10px' }}>Recent estimates</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Voucher</th><th>Date</th><th>Customer</th><th>Total</th></tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.voucher_no}</td>
                <td>{r.voucher_date}</td>
                <td>{r.accounts?.name ?? r.customer_name ?? '—'}</td>
                <td className="num">₹{money(r.total)}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={4} className="empty-note">No estimates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
