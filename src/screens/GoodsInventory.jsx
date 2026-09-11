import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BarcodeScanner from '../components/BarcodeScanner'

const NEW_CATEGORY = '__new_category__'
const NEW_GROUP = '__new_group__'

const IMPORT_FIELDS = [
  'goods_name', 'barcode', 'uom', 'category_name', 'hsn_sac_code', 'group_name',
  'tax_percent', 'mrp', 'lot_value', 'min_sale_price', 'opening_qty', 'reorder_qty',
  'min_stock', 'max_stock', 'batch_no', 'expiry_date', 'alt_uom', 'alt_uom_factor',
]

const IMPORT_TEMPLATE_CSV =
  IMPORT_FIELDS.join(',') +
  '\n' +
  'Toor Dal 1kg,8901030800001,Pc,Groceries,1006,Local Farms,5,145,110,,50,20,,,,,,\n' +
  'Basmati Rice 5kg,,Pc,Groceries,1006,,5,410,330,,20,10,,,,,,\n'

// Very small RFC4180-ish CSV parser: handles quoted fields, escaped quotes ("") and CRLF/LF.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

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
  const [scanTarget, setScanTarget] = useState(null) // 'form' | 'search' | null

  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState('upload') // 'upload' | 'preview' | 'results'
  const [importFileName, setImportFileName] = useState('')
  const [importParseError, setImportParseError] = useState(null)
  const [importPreview, setImportPreview] = useState([]) // [{ normalized, willCreate, note, issue }]
  const [importResults, setImportResults] = useState([])
  const [importing, setImporting] = useState(false)

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

  function handleScanned(code) {
    if (scanTarget === 'search') {
      setSearch(code)
    } else if (scanTarget === 'form') {
      updateForm('barcode', code)
    }
    setScanTarget(null)
  }

  function downloadImportTemplate() {
    const blob = new Blob([IMPORT_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'saral-goods-import-template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function resetImport() {
    setImportStep('upload')
    setImportFileName('')
    setImportParseError(null)
    setImportPreview([])
    setImportResults([])
  }

  function classifyImportRow(norm) {
    const barcode = norm.barcode.trim()
    if (barcode && rows.some((r) => r.barcode === barcode || r.lot_barcode === barcode)) {
      return { willCreate: false, note: 'Matches by barcode' }
    }
    const name = norm.goods_name.trim().toLowerCase()
    const nameMatches = name ? rows.filter((r) => r.goods_name.trim().toLowerCase() === name) : []
    if (nameMatches.length === 1) return { willCreate: false, note: 'Matches by name' }
    if (nameMatches.length > 1) return { willCreate: false, note: 'Multiple batches — new batch added' }
    return { willCreate: true, note: 'New item' }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportParseError(null)
    setImportFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const table = parseCsv(text)
        if (table.length < 2) {
          setImportParseError('No data rows found. Make sure the first row is the header and there is at least one item below it.')
          return
        }
        const headers = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
        if (!headers.includes('goods_name')) {
          setImportParseError('The CSV must have a "goods_name" column. Download the template below to see the expected columns.')
          return
        }
        const preview = table.slice(1).map((cells) => {
          const norm = {}
          IMPORT_FIELDS.forEach((f) => { norm[f] = '' })
          headers.forEach((h, i) => {
            if (IMPORT_FIELDS.includes(h)) norm[h] = (cells[i] ?? '').trim()
          })
          const { willCreate, note } = classifyImportRow(norm)
          let issue = null
          if (!norm.goods_name) issue = 'Goods name is required'
          else if (willCreate && !norm.mrp) issue = 'MRP is required for new items'
          else if (norm.mrp && Number(norm.mrp) <= 0) issue = 'MRP must be greater than zero'
          return { normalized: norm, willCreate, note, issue }
        })
        setImportPreview(preview)
        setImportStep('preview')
      } catch (err) {
        setImportParseError('Could not read that file as CSV: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  async function handleCommitImport() {
    setImporting(true)
    const { data, error } = await supabase.rpc('import_goods_csv', {
      p_branch_id: profile.home_branch_id,
      p_rows: importPreview.map((r) => r.normalized),
    })
    setImporting(false)
    if (error) {
      setImportParseError(error.message)
      return
    }
    setImportResults(data ?? [])
    setImportStep('results')
    await load()
    await loadLookups()
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
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowImport((v) => !v)
                resetImport()
              }}
            >
              {showImport ? 'Cancel' : '⬆ Import CSV'}
            </button>
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Add Goods'}
            </button>
          </div>
        )}
      </div>

      {showImport && (
        <div className="card" style={{ maxWidth: 820, marginBottom: 20 }}>
          <h3>Import Goods from CSV</h3>

          {importStep === 'upload' && (
            <>
              <p className="card-sub">
                Upload a CSV to add many items at once. Each row needs at least a <strong>goods_name</strong> — new items
                also need an <strong>mrp</strong>. If a row matches an item you already have (same barcode, or same name),
                its details are updated and the quantity is <strong>added</strong> to current stock rather than replacing it.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  Choose CSV file
                  <input type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
                </label>
                <button type="button" className="btn btn-ghost" onClick={downloadImportTemplate}>
                  Download CSV template
                </button>
              </div>
              {importParseError && <div className="login-error" style={{ marginTop: 12 }}>{importParseError}</div>}
            </>
          )}

          {importStep === 'preview' && (
            <>
              <p className="card-sub">
                <strong>{importFileName}</strong> · {importPreview.length} row{importPreview.length === 1 ? '' : 's'} ·{' '}
                {importPreview.filter((r) => r.willCreate).length} new ·{' '}
                {importPreview.filter((r) => !r.willCreate).length} matching existing items
                {importPreview.some((r) => r.issue) && (
                  <> · <span style={{ color: 'var(--red)' }}>{importPreview.filter((r) => r.issue).length} with an issue</span></>
                )}
              </p>
              <div className="table-wrap" style={{ marginTop: 10, maxHeight: 360, overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Goods</th>
                      <th>Barcode</th>
                      <th className="num">MRP</th>
                      <th className="num">Qty to add</th>
                      <th>Will</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i}>
                        <td className="num">{i + 1}</td>
                        <td className="strong">{r.normalized.goods_name || <em>(blank)</em>}</td>
                        <td>{r.normalized.barcode || '—'}</td>
                        <td className="num">{r.normalized.mrp || '—'}</td>
                        <td className="num">{r.normalized.opening_qty || '0'}</td>
                        <td>
                          {r.issue ? (
                            <span className="chip out">{r.issue}</span>
                          ) : (
                            <span className={`chip ${r.willCreate ? 'ok' : 'low'}`}>{r.note}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importParseError && <div className="login-error" style={{ marginTop: 12 }}>{importParseError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={handleCommitImport} disabled={importing}>
                  {importing ? 'Importing…' : `Import ${importPreview.length} row${importPreview.length === 1 ? '' : 's'}`}
                </button>
                <button className="btn btn-ghost" onClick={resetImport} disabled={importing}>
                  Choose a different file
                </button>
              </div>
            </>
          )}

          {importStep === 'results' && (
            <>
              <p className="card-sub">
                {importResults.filter((r) => r.status === 'created').length} created ·{' '}
                {importResults.filter((r) => r.status === 'updated').length} updated ·{' '}
                {importResults.filter((r) => r.status === 'error').length} failed
              </p>
              <div className="table-wrap" style={{ marginTop: 10, maxHeight: 360, overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Goods</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.map((r) => (
                      <tr key={r.row_num}>
                        <td className="num">{r.row_num}</td>
                        <td className="strong">{r.item_name || '—'}</td>
                        <td>
                          <span className={`chip ${r.status === 'error' ? 'out' : 'ok'}`}>{r.status}</span>
                        </td>
                        <td>{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowImport(false)
                    resetImport()
                  }}
                >
                  Done
                </button>
                <button className="btn btn-ghost" onClick={resetImport}>
                  Import another file
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
              <div className="barcode-field">
                <input value={form.barcode} onChange={(e) => updateForm('barcode', e.target.value)} placeholder="Scan or type" />
                <button type="button" className="btn btn-ghost" onClick={() => setScanTarget('form')}>📷 Scan</button>
              </div>
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
        <div className="search-box barcode-field">
          <input placeholder="Search goods or scan/type barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className="btn btn-ghost" onClick={() => setScanTarget('search')}>📷 Scan</button>
        </div>
      </div>

      {scanTarget && <BarcodeScanner onDetected={handleScanned} onClose={() => setScanTarget(null)} />}

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
