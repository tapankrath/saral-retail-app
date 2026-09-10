import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function StockAdjust() {
  const { profile, canAdd } = useAuth()
  const canAdjust = canAdd('stock_adjust')
  const canTake = canAdd('stock_taking')
  const [mode, setMode] = useState(canAdjust ? 'adjust' : 'take')
  const [goods, setGoods] = useState([])
  const [lotId, setLotId] = useState('')
  const [qtyDelta, setQtyDelta] = useState('')
  const [reason, setReason] = useState('')
  const [countedQty, setCountedQty] = useState('')
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

  async function loadGoods() {
    const { data: goodsRows } = await supabase.from('goods_with_stock').select('*').order('goods_name')
    setGoods(goodsRows ?? [])
  }

  useEffect(() => {
    loadGoods()
    loadRecent()
  }, [])

  const selectedGoods = goods.find((g) => g.lot_id === lotId)
  const takeDelta = selectedGoods && countedQty !== '' ? Number(countedQty) - Number(selectedGoods.current_qty) : null

  async function submitAdjustment(delta, reasonText) {
    setError(null)
    setResult(null)
    setSubmitting(true)
    const { error } = await supabase.rpc('create_stock_adjustment', {
      p_branch_id: profile.home_branch_id,
      p_lot_id: lotId,
      p_qty_delta: delta,
      p_reason: reasonText,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setResult(mode === 'adjust' ? 'Adjustment recorded.' : 'Stock take applied — system quantity now matches your count.')
    setQtyDelta('')
    setReason('')
    setCountedQty('')
    setLotId('')
    await Promise.all([loadRecent(), loadGoods()])
  }

  async function handleAdjustSubmit() {
    if (!lotId || !qtyDelta || Number(qtyDelta) === 0 || !reason.trim()) {
      setError('Pick a goods, a non-zero quantity, and enter a reason.')
      return
    }
    await submitAdjustment(Number(qtyDelta), reason.trim())
  }

  async function handleTakeSubmit() {
    if (!lotId || countedQty === '') {
      setError('Pick a goods and enter the counted quantity.')
      return
    }
    if (takeDelta === 0) {
      setError('Counted quantity matches the system quantity — nothing to adjust.')
      return
    }
    await submitAdjustment(takeDelta, 'Stock taking correction')
  }

  if (!canAdjust && !canTake) {
    return (
      <section>
        <div className="page-head"><h1>Stock Adjust</h1></div>
        <p className="empty-note">Your account doesn't have permission to adjust stock.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>{mode === 'adjust' ? 'Stock Adjust' : 'Stock Taking'}</h1>
          <p className="sub">
            {mode === 'adjust'
              ? 'Corrects stock for damage, loss, or a physical count mismatch — always with a reason on record'
              : 'Enter what you physically counted — the system works out the difference and posts it as an adjustment'}
          </p>
        </div>
      </div>

      <div className="tab-row">
        {canAdjust && <button className={`tab${mode === 'adjust' ? ' active' : ''}`} onClick={() => setMode('adjust')}>Stock Adjust</button>}
        {canTake && <button className={`tab${mode === 'take' ? ' active' : ''}`} onClick={() => setMode('take')}>Stock Taking</button>}
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          {result}
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      {mode === 'adjust' ? (
        <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <div className="field" style={{ marginTop: 0 }}>
            <label>Goods</label>
            <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">Select goods…</option>
              {goods.map((g) => (
                <option key={g.lot_id} value={g.lot_id}>{g.goods_name} — currently {g.current_qty} {g.uom}</option>
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
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleAdjustSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
          <div className="field" style={{ marginTop: 0 }}>
            <label>Goods</label>
            <select value={lotId} onChange={(e) => { setLotId(e.target.value); setCountedQty('') }}>
              <option value="">Select goods…</option>
              {goods.map((g) => (
                <option key={g.lot_id} value={g.lot_id}>{g.goods_name} — system says {g.current_qty} {g.uom}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Physically counted quantity</label>
            <input type="number" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} placeholder="e.g. 48" />
          </div>
          {selectedGoods && countedQty !== '' && (
            <p className="sub" style={{ marginTop: 4 }}>
              System: {selectedGoods.current_qty} {selectedGoods.uom} · Counted: {countedQty} {selectedGoods.uom} ·{' '}
              {takeDelta === 0 ? 'no difference' : `will post ${takeDelta > 0 ? '+' : ''}${takeDelta} ${selectedGoods.uom}`}
            </p>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleTakeSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Apply Stock Take'}
          </button>
        </div>
      )}

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
                <td className="num">{Number(r.qty_delta) > 0 ? '+' : ''}{r.qty_delta}</td>
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
