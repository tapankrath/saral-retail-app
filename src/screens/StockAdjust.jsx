import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function StockAdjust() {
  const { profile, canAdd } = useAuth()
  const [goods, setGoods] = useState([])
  const [lotId, setLotId] = useState('')
  const [qtyDelta, setQtyDelta] = useState('')
  const [reason, setReason] = useState('')
  const [recent, setRecent] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function loadRecent() {
    const { data } = await supabase
      .from('stock_adjustments')
      .select('id, qty_delta, reason, created_at, goods_lots(goods_id, goods(goods_name))')
      .order('created_at', { ascending: false })
      .limit(10)
    setRecent(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const { data: goodsRows } = await supabase.from('goods_with_stock').select('*').order('goods_name')
      setGoods(goodsRows ?? [])
      await loadRecent()
    }
    load()
  }, [])

  async function handleSubmit() {
    setError(null)
    setResult(null)
    if (!lotId || !qtyDelta || Number(qtyDelta) === 0 || !reason.trim()) {
      setError('Pick a goods, a non-zero quantity, and enter a reason.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.rpc('create_stock_adjustment', {
      p_branch_id: profile.home_branch_id,
      p_lot_id: lotId,
      p_qty_delta: Number(qtyDelta),
      p_reason: reason.trim(),
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setResult('Adjustment recorded.')
    setQtyDelta('')
    setReason('')
    await loadRecent()
  }

  if (!canAdd('stock_adjust')) {
    return (
      <section>
        <div className="page-head">
          <h1>Stock Adjust</h1>
        </div>
        <p className="empty-note">Your account doesn't have permission to adjust stock.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Stock Adjust</h1>
          <p className="sub">Corrects stock for damage, loss, or a physical count mismatch — always with a reason on record</p>
        </div>
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          {result}
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <div className="field" style={{ marginTop: 0 }}>
          <label>Goods</label>
          <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">Select goods…</option>
            {goods.map((g) => (
              <option key={g.lot_id} value={g.lot_id}>
                {g.goods_name} — currently {g.current_qty} {g.uom}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantity change (negative for loss/damage, positive for found stock)</label>
          <input type="number" value={qtyDelta} onChange={(e) => setQtyDelta(e.target.value)} placeholder="e.g. -2" />
        </div>
        <div className="field">
          <label>Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged in stockroom" />
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Adjustment'}
        </button>
      </div>

      <h3 style={{ marginBottom: 10 }}>Recent adjustments</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Goods</th>
              <th>Change</th>
              <th>Reason</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.goods_lots?.goods?.goods_name ?? '—'}</td>
                <td className={`num ${Number(r.qty_delta) < 0 ? '' : ''}`}>{Number(r.qty_delta) > 0 ? '+' : ''}{r.qty_delta}</td>
                <td>{r.reason}</td>
                <td className="num">{new Date(r.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-note">
                  No adjustments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
