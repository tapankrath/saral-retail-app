import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatAmount, currencySymbol } from '../lib/money'

export default function SalesReturn() {
  const { profile, canAdd } = useAuth()
  const country = profile?.organizations?.country || 'IN'
  const sym = currencySymbol(country)
  function money(n) {
    return formatAmount(n, country)
  }
  const [accounts, setAccounts] = useState([])
  const [goods, setGoods] = useState([])
  const [accountId, setAccountId] = useState('')
  const [referenceNo, setReferenceNo] = useState('')
  const [goodsQuery, setGoodsQuery] = useState('')
  const [lines, setLines] = useState([])
  const [cashRefund, setCashRefund] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

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
    }
    load()
  }, [])

  const goodsMatches = useMemo(() => {
    if (!goodsQuery) return []
    return goods.filter((g) => g.goods_name.toLowerCase().includes(goodsQuery.toLowerCase())).slice(0, 6)
  }, [goodsQuery, goods])

  function addLine(g) {
    setLines((prev) => [...prev, { lot_id: g.lot_id, goods_name: g.goods_name, rate: Number(g.mrp), tax_pct: Number(g.tax_percent ?? 0), qty: 1 }])
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
    if (!accountId) {
      setError('Pick the customer the goods are coming back from.')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('create_sales_return_voucher', {
      p_branch_id: profile.home_branch_id,
      p_voucher_date: new Date().toISOString().slice(0, 10),
      p_account_id: accountId,
      p_lines: lines.map((l) => ({ lot_id: l.lot_id, rate: Number(l.rate), tax_pct: l.tax_pct, qty: Number(l.qty) })),
      p_reference_voucher_no: referenceNo || null,
      p_cash_refund: cashRefund === '' ? 0 : Number(cashRefund),
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
    setReferenceNo('')
    setCashRefund('')
  }

  if (!canAdd('sales_return')) {
    return (
      <section>
        <div className="page-head"><h1>Sales Return</h1></div>
        <p className="empty-note">Your account doesn't have permission to create sales returns.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Sales Return</h1>
          <p className="sub">Goods coming back from a customer — reverses the original sale's stock and ledger effect</p>
        </div>
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          Return <strong>{result.voucher_no}</strong> posted successfully.
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="voucher-head-grid">
        <div className="field" style={{ marginTop: 0 }}>
          <label>Customer</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Select customer…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Original Sales Voucher No. (optional)</label>
          <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="e.g. S0000001" />
        </div>
      </div>

      <div className="voucher-grid">
        <div>
          <div className="line-toolbar">
            <div className="search-box" style={{ maxWidth: '100%', flex: 1 }}>
              <input placeholder="Search goods being returned" value={goodsQuery} onChange={(e) => setGoodsQuery(e.target.value)} />
            </div>
          </div>
          {goodsMatches.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table className="data">
                <tbody>
                  {goodsMatches.map((g) => (
                    <tr key={g.lot_id} onClick={() => addLine(g)} style={{ cursor: 'pointer' }}>
                      <td className="strong">{g.goods_name}</td>
                      <td className="num">MRP {sym}{money(g.mrp)}</td>
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
                    <td className="num">{sym}{money(l.total)}</td>
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
          <h3>Return summary</h3>
          <div className="summary-row"><span>Goods value</span><span className="tnum">{sym}{money(totalGoods)}</span></div>
          <div className="summary-row"><span>Tax reversed</span><span className="tnum">{sym}{money(totalTax)}</span></div>
          <div className="summary-row total"><span>Total credit</span><span className="val tnum">{sym}{money(grandTotal)}</span></div>
          <div className="field">
            <label>Cash refunded now (rest reduces their balance)</label>
            <input type="number" value={cashRefund} onChange={(e) => setCashRefund(e.target.value)} placeholder="0" />
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Posting…' : 'Save & Post Return'}
          </button>
        </div>
      </div>
    </section>
  )
}
