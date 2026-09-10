import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const NEW_CATEGORY = '__new_category__'
const NEW_GROUP = '__new_group__'

const emptyForm = {
  goodsName: '',
  uom: 'Pc',
  taxTypeId: '',
  categoryId: '',
  groupId: '',
  reorderQty: '',
  minStock: '',
  maxStock: '',
  mrp: '',
  lotValue: '',
  minSalePrice: '',
  openingQty: '',
  barcode: '',
  altUom: '',
  altUomFactor: '',
  batchNo: '',
  expiryDate: '',
}

export default function GoodsInventory() {
  const { profile, canAdd, canEdit } = useAuth()
  const [rows, setRows] = useState([])
  const [taxTypes, setTaxTypes] = useState([])
  const [categories, setCategories] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', hsn: '' })
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroup, setNewGroup] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('goods_with_stock').select('*').order('goods_name')
    if (error) setError(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  async function loadLookups() {
    const [{ data: taxRows }, { data: catRows }, { data: grpRows }] = await Promise.all([
      supabase.from('tax_types').select('id, name, tax_percent').order('tax_percent'),
      supabase.from('goods_categories').select('id, name').order('name'),
      supabase.from('goods_groups').select('id, name').order('name'),
    ])
    setTaxTypes(taxRows ?? [])
    setCategories(catRows ?? [])
    setGroups(grpRows ?? [])
  }

  useEffect(() => {
    load()
    loadLookups()
  }, [])

  const filtered = rows.filter(
    (r) =>
      r.goods_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.barcode ?? '').includes(search) ||
      (r.lot_barcode ?? '').includes(search)
  )

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleCategoryChange(value) {
    if (value === NEW_CATEGORY) {
      setShowAddCategory(true)
      return
    }
    updateForm('categoryId', value)
  }

  function handleGroupChange(value) {
    if (value === NEW_GROUP) {
      setShowAddGroup(true)
      return
    }
    updateForm('groupId', value)
  }

  async function handleAddCategory() {
    if (!newCategory.name.trim()) return
    const { data, error } = await supabase
      .from('goods_categories')
      .insert({ organization_id: profile.organization_id, name: newCategory.name.trim(), hsn_sac_code: newCategory.hsn || null })
      .select('id')
      .single()
    if (error) {
      setFormError(error.message)
      return
    }
    await loadLookups()
    updateForm('categoryId', data.id)
    setNewCategory({ name: '', hsn: '' })
    setShowAddCategory(false)
  }

  async function handleAddGroup() {
    if (!newGroup.trim()) return
    const { data, error } = await supabase
      .from('goods_groups')
      .insert({ organization_id: profile.organization_id, name: newGroup.trim() })
      .select('id')
      .single()
    if (error) {
      setFormError(error.message)
      return
    }
    await loadLookups()
    updateForm('groupId', data.id)
    setNewGroup('')
    setShowAddGroup(false)
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
      p_category_id: form.categoryId || null,
      p_group_id: form.groupId || null,
      p_barcode: form.barcode || null,
      p_alt_uom: form.altUom || null,
      p_alt_uom_factor: form.altUomFactor === '' ? null : Number(form.altUomFactor),
      p_batch_no: form.batchNo || null,
      p_expiry_date: form.expiryDate || null,
      p_min_stock: form.minStock === '' ? null : Number(form.minStock),
      p_max_stock: form.maxStock === '' ? null : Number(form.maxStock),
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
        <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
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
              <label>Category</label>
              <select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {canEdit('goods_setup') && <option value={NEW_CATEGORY}>+ Add new category…</option>}
              </select>
            </div>
            <div className="field">
              <label>Brand / Company</label>
              <select value={form.groupId} onChange={(e) => handleGroupChange(e.target.value)}>
                <option value="">No brand</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                {canEdit('goods_setup') && <option value={NEW_GROUP}>+ Add new brand…</option>}
              </select>
            </div>
          </div>

          {showAddCategory && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="field-row">
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Category name</label>
                  <input value={newCategory.name} onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>HSN/SAC code (optional)</label>
                  <input value={newCategory.hsn} onChange={(e) => setNewCategory((p) => ({ ...p, hsn: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={handleAddCategory}>Save category</button>
                <button className="btn btn-ghost" onClick={() => setShowAddCategory(false)}>Cancel</button>
              </div>
            </div>
          )}
          {showAddGroup && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="field" style={{ marginTop: 0 }}>
                <label>Brand / company name</label>
                <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={handleAddGroup}>Save brand</button>
                <button className="btn btn-ghost" onClick={() => setShowAddGroup(false)}>Cancel</button>
              </div>
            </div>
          )}

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
              <label>Barcode (optional)</label>
              <input value={form.barcode} onChange={(e) => updateForm('barcode', e.target.value)} placeholder="Scan or type" />
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

          <div className="field-row">
            <div className="field">
              <label>Batch no. (optional)</label>
              <input value={form.batchNo} onChange={(e) => updateForm('batchNo', e.target.value)} />
            </div>
            <div className="field">
              <label>Expiry date (optional)</label>
              <input type="date" value={form.expiryDate} onChange={(e) => updateForm('expiryDate', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Alternate UOM (optional)</label>
              <input value={form.altUom} onChange={(e) => updateForm('altUom', e.target.value)} placeholder="e.g. kg" />
            </div>
            <div className="field">
              <label>1 {form.uom || 'Pc'} = how many alt units</label>
              <input type="number" value={form.altUomFactor} onChange={(e) => updateForm('altUomFactor', e.target.value)} placeholder="e.g. 10" />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Reorder level (optional)</label>
              <input type="number" value={form.reorderQty} onChange={(e) => updateForm('reorderQty', e.target.value)} placeholder="e.g. 20" />
            </div>
            <div className="field">
              <label>Min / Max stock (optional)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={form.minStock} onChange={(e) => updateForm('minStock', e.target.value)} placeholder="Min" />
                <input type="number" value={form.maxStock} onChange={(e) => updateForm('maxStock', e.target.value)} placeholder="Max" />
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleAddGoods} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Goods'}
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <input placeholder="Search goods or scan/type barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                <th>Brand</th>
                <th>Tax</th>
                <th>Stock</th>
                <th>Reorder</th>
                <th>MRP</th>
                <th>Batch / Expiry</th>
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
                    <td className="strong">
                      {g.goods_name}
                      {g.barcode && <div style={{ fontSize: '.7rem', color: 'var(--muted)' }}>#{g.barcode}</div>}
                    </td>
                    <td>{g.category_name ?? '—'}</td>
                    <td>{g.group_name ?? '—'}</td>
                    <td className="num">{g.tax_percent != null ? `${g.tax_percent}%` : '—'}</td>
                    <td className="num">
                      {qty} {g.uom}
                    </td>
                    <td className="num">{reorder ?? '—'}</td>
                    <td className="num">₹{Number(g.mrp).toFixed(2)}</td>
                    <td>
                      {g.batch_no ?? '—'}
                      {g.expiry_date ? ` · exp ${g.expiry_date}` : ''}
                    </td>
                    <td>
                      <span className={`chip ${status}`}>{status === 'ok' ? 'OK' : status === 'low' ? 'Low' : 'Out'}</span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-note">
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
