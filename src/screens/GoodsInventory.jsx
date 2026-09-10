import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const emptyForm = {
  goodsName: '',
  uom: 'Pc',
  taxTypeId: '',
  reorderQty: '',
  mrp: '',
  lotValue: '',
  minSalePrice: '',
  openingQty: '',
}

export default function GoodsInventory() {
  const { profile, canAdd } = useAuth()
  const [rows, setRows] = useState([])
  const [taxTypes, setTaxTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('goods_with_stock').select('*').order('goods_name')
    if (error) setError(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    supabase
      .from('tax_types')
      .select('id, name, tax_percent')
      .order('tax_percent')
      .then(({ data }) => setTaxTypes(data ?? []))
  }, [])

  const filtered = rows.filter((r) => r.goods_name.toLowerCase().includes(search.toLowerCase()))

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleAddGoods() {
    setFormError(null)
    if (!form.goodsName.trim()) {
      setFormError('Goods name is required.')
      return
    }
    if (!form.mrp || Number(form.mrp) <= 0) {
      setFormError('Enter an MRP greater than zero.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.rpc('create_goods', {
      p_branch_id: profile.home_branch_id,
      p_goods_name: form.goodsName.trim(),
      p_uom: form.uom || 'Pc',
      p_tax_type_id: form.taxTypeId || null,
      p_reorder_qty: form.reorderQty === '' ? null : Number(form.reorderQty),
      p_mrp: Number(form.mrp),
      p_lot_value: form.lotValue === '' ? 0 : Number(form.lotValue),
      p_min_sale_price: form.minSalePrice === '' ? null : Number(form.minSalePrice),
      p_opening_qty: form.openingQty === '' ? 0 : Number(form.openingQty),
    })
    setSubmitting(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setForm(emptyForm)
    setShowForm(false)
    await load()
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Goods &amp; Inventory</h1>
          <p className="sub">{rows.length} goods · live from your Supabase database</p>
        </div>
        {canAdd('goods_setup') && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Add Goods'}
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ maxWidth: 640, marginBottom: 20 }}>
          <h3>Add Goods</h3>
          {formError && <div className="login-error">{formError}</div>}
          <div className="field-row">
            <div className="field" style={{ marginTop: 0 }}>
              <label>Goods name</label>
              <input value={form.goodsName} onChange={(e) => updateForm('goodsName', e.target.value)} placeholder="e.g. Toor Dal 1kg" />
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <label>Unit (UOM)</label>
              <input value={form.uom} onChange={(e) => updateForm('uom', e.target.value)} placeholder="Pc" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Tax rate</label>
              <select value={form.taxTypeId} onChange={(e) => updateForm('taxTypeId', e.target.value)}>
                <option value="">No tax</option>
                {taxTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Reorder level (optional)</label>
              <input type="number" value={form.reorderQty} onChange={(e) => updateForm('reorderQty', e.target.value)} placeholder="e.g. 20" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>MRP</label>
              <input type="number" value={form.mrp} onChange={(e) => updateForm('mrp', e.target.value)} placeholder="e.g. 120" />
            </div>
            <div className="field">
              <label>Cost / lot value</label>
              <input type="number" value={form.lotValue} onChange={(e) => updateForm('lotValue', e.target.value)} placeholder="e.g. 95" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Min sale price (optional)</label>
              <input type="number" value={form.minSalePrice} onChange={(e) => updateForm('minSalePrice', e.target.value)} />
            </div>
            <div className="field">
              <label>Opening stock qty (optional)</label>
              <input type="number" value={form.openingQty} onChange={(e) => updateForm('openingQty', e.target.value)} placeholder="0" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleAddGoods} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Goods'}
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <input placeholder="Search goods" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <p className="empty-note">Couldn't load goods: {error}</p>}
      {loading ? (
        <p className="empty-note">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Goods</th>
                <th>Category</th>
                <th>Tax</th>
                <th>Stock</th>
                <th>Reorder</th>
                <th>MRP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const qty = Number(g.current_qty)
                const reorder = g.reorder_qty != null ? Number(g.reorder_qty) : null
                const status = qty <= 0 ? 'out' : reorder != null && qty <= reorder ? 'low' : 'ok'
                return (
                  <tr key={g.lot_id}>
                    <td className="strong">{g.goods_name}</td>
                    <td>{g.category_name ?? '—'}</td>
                    <td className="num">{g.tax_percent != null ? `${g.tax_percent}%` : '—'}</td>
                    <td className="num">
                      {qty} {g.uom}
                    </td>
                    <td className="num">{reorder ?? '—'}</td>
                    <td className="num">₹{Number(g.mrp).toFixed(2)}</td>
                    <td>
                      <span className={`chip ${status}`}>{status === 'ok' ? 'OK' : status === 'low' ? 'Low' : 'Out'}</span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-note">
                    {rows.length === 0 ? 'No goods yet — add your first one above.' : `No goods match "${search}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
