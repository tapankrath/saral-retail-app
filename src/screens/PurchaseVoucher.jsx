import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const NEW_SUPPLIER = '__new__'

export default function PurchaseVoucher() {
  const { profile, canAdd } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [goods, setGoods] = useState([])
  const [accountId, setAccountId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [goodsQuery, setGoodsQuery] = useState('')
  const [lines, setLines] = useState([])
  const [payMethod, setPayMethod] = useState('credit')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [creditorGroupId, setCreditorGroupId] = useState(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', mobile: '', gstin: '', email: '' })
  const [addSupplierError, setAddSupplierError] = useState(null)
  const [addingSupplier, setAddingSupplier] = useState(false)

  async function loadSuppliers() {
    // suppliers are accounts under a liabilities group without a system_role
    const { data: acctRows } = await supabase
      .from('accounts')
      .select('id, name, account_groups(transaction_type)')
      .is('system_role', null)
      .order('name')
    setSuppliers((acctRows ?? []).filter((a) => a.account_groups?.transaction_type === 'liabilities'))
  }

  useEffect(() => {
    loadSuppliers()
    supabase
      .from('account_groups')
      .select('id')
      .eq('name', 'Sundry Creditors')
      .maybeSingle()
      .then(({ data }) => setCreditorGroupId(data?.id ?? null))
    async function load() {
      const { data: goodsRows } = await supabase.from('goods_with_stock').select('*').order('goods_name')
      setGoods(goodsRows ?? [])
    }
    load()
  }, [])

  function handleSupplierChange(value) {
    if (value === NEW_SUPPLIER) {
      setShowAddSupplier(true)
      return
    }
    setAccountId(value)
  }

  async function handleAddSupplier() {
    setAddSupplierError(null)
    if (!newSupplier.name.trim()) {
      setAddSupplierError('Supplier name is required.')
      return
    }
    if (!creditorGroupId) {
      setAddSupplierError("Couldn't find the Sundry Creditors account group.")
      return
    }
    setAddingSupplier(true)
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        organization_id: profile.organization_id,
        account_group_id: creditorGroupId,
        name: newSupplier.name.trim(),
        mobile: newSupplier.mobile || null,
        gstin: newSupplier.gstin || null,
        email: newSupplier.email || null,
      })
      .select('id')
      .single()
    setAddingSupplier(false)
    if (error) {
      setAddSupplierError(error.message)
      return
    }
    await loadSuppliers()
    setAccountId(data.id)
    setNewSupplier({ name: '', mobile: '', gstin: '', email: '' })
    setShowAddSupplier(false)
  }

  const goodsMatches = useMemo(() => {
    if (!goodsQuery) return []
    return goods.filter((g) => g.goods_name.toLowerCase().includes(goodsQuery.toLowerCase())).slice(0, 6)
  }, [goodsQuery, goods])

  function addLine(g) {
    setLines((prev) => [
      ...prev,
      { lot_id: g.lot_id, goods_name: g.goods_name, rate: Number(g.lot_value) || 0, tax_pct: Number(g.tax_percent ?? 0), qty: 1 },
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
      setError('Pick a supplier first.')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('create_purchase_voucher', {
      p_branch_id: profile.home_branch_id,
      p_voucher_date: new Date().toISOString().slice(0, 10),
      p_account_id: accountId,
      p_lines: lines.map((l) => ({ lot_id: l.lot_id, rate: Number(l.rate), tax_pct: l.tax_pct, qty: Number(l.qty) })),
      p_cash_amount: payMethod === 'cash' ? Number(grandTotal.toFixed(2)) : 0,
      p_card_amount: payMethod === 'card' ? Number(grandTotal.toFixed(2)) : 0,
      p_credit_amount: payMethod === 'credit' ? Number(grandTotal.toFixed(2)) : 0,
      p_supplier_invoice_no: invoiceNo || null,
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
    setInvoiceNo('')
  }

  if (!canAdd('purchase_voucher')) {
    return (
      <section>
        <div className="page-head">
          <h1>Purchase Voucher</h1>
        </div>
        <p className="empty-note">Your account doesn't have permission to create purchase vouchers.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Purchase Voucher</h1>
          <p className="sub">Posts to purchase_vouchers, ledger_entries and stock_ledger in one transaction</p>
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
          <label>Supplier</label>
          <select value={accountId} onChange={(e) => handleSupplierChange(e.target.value)}>
            <option value="">Select supplier…</option>
            {suppliers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {canAdd('account_setup') && <option value={NEW_SUPPLIER}>+ Add new supplier…</option>}
          </select>
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Supplier Invoice No.</label>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
      </div>

      {showAddSupplier && (
        <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
          <h3>Add new supplier</h3>
          {addSupplierError && <div className="login-error">{addSupplierError}</div>}
          <div className="field" style={{ marginTop: 0 }}>
            <label>Name</label>
            <input value={newSupplier.name} onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Mobile (optional)</label>
              <input value={newSupplier.mobile} onChange={(e) => setNewSupplier((p) => ({ ...p, mobile: e.target.value }))} />
            </div>
            <div className="field">
              <label>GSTIN (optional)</label>
              <input value={newSupplier.gstin} onChange={(e) => setNewSupplier((p) => ({ ...p, gstin: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Email (optional)</label>
            <input value={newSupplier.email} onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleAddSupplier} disabled={addingSupplier}>
              {addingSupplier ? 'Saving…' : 'Save supplier'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowAddSupplier(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
                      <td className="num">Last cost ₹{money(g.lot_value)}</td>
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
                      <input style={{ width: 80, font: 'inherit' }} type="number" value={l.rate} onChange={(e) => updateLine(idx, 'rate', e.target.value)} />
                    </td>
                    <td className="num">
                      <input style={{ width: 60, font: 'inherit' }} type="number" value={l.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} />
                    </td>
                    <td className="num">{l.tax_pct}%</td>
                    <td className="num">₹{money(l.total)}</td>
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
            <span className="tnum">₹{money(totalGoods)}</span>
          </div>
          <div className="summary-row">
            <span>Tax (input credit)</span>
            <span className="tnum">₹{money(totalTax)}</span>
          </div>
          <div className="summary-row total">
            <span>Total payable</span>
            <span className="val tnum">₹{money(grandTotal)}</span>
          </div>
          <p style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 10 }}>Settled by</p>
          <div className="pay-toggle">
            {['credit', 'cash', 'card'].map((m) => (
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
