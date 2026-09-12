import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BarcodeScanner from '../components/BarcodeScanner'
import { formatAmount, currencySymbol } from '../lib/money'

const NEW_CUSTOMER = '__new__'

export default function SalesVoucher() {
  const { profile, canAdd } = useAuth()
  const country = profile?.organizations?.country || 'IN'
  const sym = currencySymbol(country)
  function money(n) {
    return formatAmount(n, country)
  }
  const [accounts, setAccounts] = useState([])
  const [goods, setGoods] = useState([])
  const [accountId, setAccountId] = useState('')
  const [goodsQuery, setGoodsQuery] = useState('')
  const [lines, setLines] = useState([])
  const [payMethod, setPayMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [debtorGroupId, setDebtorGroupId] = useState(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', gstin: '', email: '' })
  const [addCustomerError, setAddCustomerError] = useState(null)
  const [addingCustomer, setAddingCustomer] = useState(false)

  async function loadAccounts() {
    // customers are accounts under an assets group without a system_role
    // (mirrors the supplier filter in Purchase Voucher, which uses 'liabilities')
    const { data: acctRows } = await supabase
      .from('accounts')
      .select('id, name, account_groups(transaction_type)')
      .is('system_role', null)
      .order('name')
    setAccounts((acctRows ?? []).filter((a) => a.account_groups?.transaction_type === 'assets'))
  }

  useEffect(() => {
    loadAccounts()
    supabase
      .from('account_groups')
      .select('id')
      .eq('name', 'Sundry Debtors')
      .maybeSingle()
      .then(({ data }) => setDebtorGroupId(data?.id ?? null))
    async function load() {
      const { data: goodsRows } = await supabase.from('goods_with_stock').select('*').order('goods_name')
      setGoods(goodsRows ?? [])
    }
    load()
  }, [])

  function handleAccountChange(value) {
    if (value === NEW_CUSTOMER) {
      setShowAddCustomer(true)
      return
    }
    setAccountId(value)
  }

  async function handleAddCustomer() {
    setAddCustomerError(null)
    if (!newCustomer.name.trim()) {
      setAddCustomerError('Customer name is required.')
      return
    }
    if (!debtorGroupId) {
      setAddCustomerError("Couldn't find the Sundry Debtors account group.")
      return
    }
    setAddingCustomer(true)
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        organization_id: profile.organization_id,
        account_group_id: debtorGroupId,
        name: newCustomer.name.trim(),
        mobile: newCustomer.mobile || null,
        gstin: newCustomer.gstin || null,
        email: newCustomer.email || null,
      })
      .select('id')
      .single()
    setAddingCustomer(false)
    if (error) {
      setAddCustomerError(error.message)
      return
    }
    await loadAccounts()
    setAccountId(data.id)
    setNewCustomer({ name: '', mobile: '', gstin: '', email: '' })
    setShowAddCustomer(false)
  }

  const goodsMatches = useMemo(() => {
    if (!goodsQuery) return []
    return goods.filter((g) => g.goods_name.toLowerCase().includes(goodsQuery.toLowerCase())).slice(0, 6)
  }, [goodsQuery, goods])

  function handleScanned(code) {
    setShowScanner(false)
    const match = goods.find((g) => g.barcode === code || g.lot_barcode === code)
    if (!match) {
      setError(`No goods found with barcode ${code}.`)
      return
    }
    setError(null)
    addLine(match)
  }

  function addLine(g) {
    setLines((prev) => [
      ...prev,
      {
        lot_id: g.lot_id,
        goods_name: g.goods_name,
        mrp: Number(g.mrp),
        rate: Number(g.mrp),
        tax_pct: Number(g.tax_percent ?? 0),
        qty: 1,
      },
    ])
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
      setError('Pick a customer account first.')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    setSubmitting(true)
    const payload = {
      p_branch_id: profile.home_branch_id,
      p_voucher_date: new Date().toISOString().slice(0, 10),
      p_account_id: accountId,
      p_lines: lines.map((l) => ({
        lot_id: l.lot_id,
        mrp: l.mrp,
        tax_pct: l.tax_pct,
        rate: Number(l.rate),
        qty: Number(l.qty),
      })),
      p_cash_amount: payMethod === 'cash' ? Number(grandTotal.toFixed(2)) : 0,
      p_card_amount: payMethod === 'card' ? Number(grandTotal.toFixed(2)) : 0,
      p_credit_amount: payMethod === 'credit' ? Number(grandTotal.toFixed(2)) : 0,
    }
    const { data, error } = await supabase.rpc('create_sales_voucher', payload)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    setResult(row)
    setLines([])
    setAccountId('')
  }

  if (!canAdd('sales_voucher')) {
    return (
      <section>
        <div className="page-head">
          <h1>Sales Voucher</h1>
        </div>
        <p className="empty-note">Your account doesn't have permission to create sales vouchers.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Sales Voucher</h1>
          <p className="sub">Posts to sales_vouchers, ledger_entries and stock_ledger in one transaction</p>
        </div>
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          Voucher <strong>{result.voucher_no}</strong> posted successfully.
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="voucher-head-grid">
        <div className="field" style={{ marginTop: 0 }}>
          <label>Customer</label>
          <select value={accountId} onChange={(e) => handleAccountChange(e.target.value)}>
            <option value="">Select customer…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {canAdd('account_setup') && <option value={NEW_CUSTOMER}>+ Add new customer…</option>}
          </select>
        </div>
      </div>

      {showAddCustomer && (
        <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
          <h3>Add new customer</h3>
          {addCustomerError && <div className="login-error">{addCustomerError}</div>}
          <div className="field" style={{ marginTop: 0 }}>
            <label>Name</label>
            <input value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Mobile (optional)</label>
              <input value={newCustomer.mobile} onChange={(e) => setNewCustomer((p) => ({ ...p, mobile: e.target.value }))} />
            </div>
            <div className="field">
              <label>GSTIN (optional)</label>
              <input value={newCustomer.gstin} onChange={(e) => setNewCustomer((p) => ({ ...p, gstin: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Email (optional)</label>
            <input value={newCustomer.email} onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleAddCustomer} disabled={addingCustomer}>
              {addingCustomer ? 'Saving…' : 'Save customer'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddCustomer(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="voucher-grid">
        <div>
          <div className="line-toolbar">
            <div className="search-box barcode-field" style={{ maxWidth: '100%', flex: 1, position: 'relative' }}>
              <input
                placeholder="Search goods to add a line"
                value={goodsQuery}
                onChange={(e) => setGoodsQuery(e.target.value)}
              />
              <button type="button" className="btn btn-ghost" onClick={() => setShowScanner(true)}>📷 Scan</button>
            </div>
          </div>
          {showScanner && <BarcodeScanner onDetected={handleScanned} onClose={() => setShowScanner(false)} />}
          {goodsMatches.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table className="data">
                <tbody>
                  {goodsMatches.map((g) => (
                    <tr key={g.lot_id} onClick={() => addLine(g)} style={{ cursor: 'pointer' }}>
                      <td className="strong">{g.goods_name}</td>
                      <td className="num">{sym}{money(g.mrp)}</td>
                      <td className="num">
                        {g.current_qty} {g.uom} in stock
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Goods</th>
                  <th>Rate</th>
                  <th>Qty</th>
                  <th>Tax%</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {computed.map((l, idx) => (
                  <tr key={idx}>
                    <td className="strong">{l.goods_name}</td>
                    <td className="num">
                      <input
                        style={{ width: 80, font: 'inherit' }}
                        type="number"
                        value={l.rate}
                        onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                      />
                    </td>
                    <td className="num">
                      <input
                        style={{ width: 60, font: 'inherit' }}
                        type="number"
                        value={l.qty}
                        onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                      />
                    </td>
                    <td className="num">{l.tax_pct}%</td>
                    <td className="num">{sym}{money(l.total)}</td>
                    <td>
                      <button className="icon-btn" onClick={() => removeLine(idx)} aria-label="Remove">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {computed.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-note">
                      Search above and click a result to add it.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Bill summary</h3>
          <div className="summary-row">
            <span>Goods value</span>
            <span className="tnum">{sym}{money(totalGoods)}</span>
          </div>
          <div className="summary-row">
            <span>Tax</span>
            <span className="tnum">{sym}{money(totalTax)}</span>
          </div>
          <div className="summary-row total">
            <span>Total due</span>
            <span className="val tnum">{sym}{money(grandTotal)}</span>
          </div>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 10 }}>Paid by</p>
          <div className="pay-toggle">
            {['cash', 'card', 'credit'].map((m) => (
              <button key={m} className={payMethod === m ? 'active' : ''} onClick={() => setPayMethod(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Posting…' : 'Save & Post Voucher'}
          </button>
        </div>
      </div>
    </section>
  )
}
