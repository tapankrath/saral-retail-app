import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function GoodsInventory() {
  const { canAdd } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('goods_with_stock')
        .select('*')
        .order('goods_name')
      if (cancelled) return
      if (error) setError(error.message)
      setRows(data ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = rows.filter((r) => r.goods_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Goods &amp; Inventory</h1>
          <p className="sub">{rows.length} goods · live from your Supabase database</p>
        </div>
        {canAdd('goods_setup') && (
          <div className="page-actions">
            <button className="btn btn-primary" disabled title="Add Goods form is next on the build list">
              + Add Goods
            </button>
          </div>
        )}
      </div>

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
                    No goods match "{search}".
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
