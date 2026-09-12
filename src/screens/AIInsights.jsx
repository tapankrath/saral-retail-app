import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatMoney } from '../lib/money'

const TABS = ['Reorder & Stock Health', 'Sales Insights', 'Customer Risk', 'Anomalies']

const MOVER_LABEL = {
  fast_moving: 'Fast-moving',
  medium_moving: 'Steady',
  slow_moving: 'Slow-moving',
  no_movement: 'No sales yet',
}

const ANOMALY_TAGS = [
  { key: 'is_unusual_amount', label: 'Unusual amount', cls: 'out' },
  { key: 'is_backdated', label: 'Backdated entry', cls: 'low' },
  { key: 'is_after_hours', label: 'After-hours entry', cls: 'low' },
]

const VOUCHER_LABEL = {
  sales_voucher: 'Sales Voucher',
  purchase_voucher: 'Purchase Voucher',
  payment_voucher: 'Payment',
  receipt_voucher: 'Receipt',
  stock_adjust: 'Stock Adjust',
}

export default function AIInsights() {
  const { canView, profile } = useAuth()
  const country = profile?.organizations?.country || 'IN'
  function money(n) {
    return formatMoney(n, country)
  }
  const [tab, setTab] = useState(TABS[0])
  const [loading, setLoading] = useState(true)
  const [reorder, setReorder] = useState([])
  const [pareto, setPareto] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [aging, setAging] = useState([])
  const [anomalies, setAnomalies] = useState([])

  useEffect(() => {
    if (!canView('reports')) return
    async function load() {
      setLoading(true)
      const [r1, r2, r3, r4, r5] = await Promise.all([
        supabase.from('v_reorder_suggestions').select('*').order('reorder_needed', { ascending: false }).order('goods_name'),
        supabase.from('v_goods_sales_pareto').select('*').order('rank'),
        supabase.from('v_top_customers').select('*').order('total_revenue', { ascending: false }),
        supabase.from('v_customer_aging_risk').select('*').order('risk_score', { ascending: false }),
        supabase.from('v_transaction_anomalies').select('*').order('created_at', { ascending: false }),
      ])
      setReorder(r1.data ?? [])
      setPareto(r2.data ?? [])
      setTopCustomers(r3.data ?? [])
      setAging(r4.data ?? [])
      setAnomalies((r5.data ?? []).filter((a) => a.is_anomaly))
      setLoading(false)
    }
    load()
  }, [canView])

  if (!canView('reports')) {
    return (
      <section>
        <div className="page-head">
          <h1>AI Insights</h1>
        </div>
        <p className="empty-note">Your account doesn't have permission to view AI insights.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>AI Insights</h1>
          <p className="sub">Computed live from your ledger and stock data — no manual setup, updates as you post vouchers</p>
        </div>
      </div>

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty-note">Crunching the numbers…</p>
      ) : tab === 'Reorder & Stock Health' ? (
        <div className="table-wrap">
          <p className="card-sub" style={{ marginBottom: 10 }}>
            Reorder level from Goods Setup; days-of-cover and the AI-suggested quantity are learned from actual sales speed.
          </p>
          <table className="data report">
            <thead>
              <tr>
                <th>Goods</th>
                <th style={{ textAlign: 'right' }}>Current Qty</th>
                <th style={{ textAlign: 'right' }}>Reorder Level</th>
                <th>Movement</th>
                <th style={{ textAlign: 'right' }}>Days of Cover</th>
                <th style={{ textAlign: 'right' }}>AI Suggested Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reorder.map((g) => (
                <tr key={g.lot_id}>
                  <td className="strong">{g.goods_name}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {g.current_qty} {g.uom}
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {g.manual_reorder_qty ?? '—'}
                  </td>
                  <td>{MOVER_LABEL[g.mover_class] ?? g.mover_class}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {g.days_of_cover != null ? `${g.days_of_cover}d` : '—'}
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {Number(g.ai_suggested_reorder_qty) > 0 ? g.ai_suggested_reorder_qty : '—'}
                  </td>
                  <td>
                    <span className={`chip ${g.reorder_needed ? (Number(g.current_qty) <= 0 ? 'out' : 'low') : 'ok'}`}>
                      {g.reorder_needed ? (Number(g.current_qty) <= 0 ? 'Reorder now' : 'Reorder soon') : 'Healthy'}
                    </span>
                  </td>
                </tr>
              ))}
              {reorder.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-note">
                    No goods set up yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'Sales Insights' ? (
        <div className="grid-2">
          <div className="card">
            <h3>Top movers (Pareto)</h3>
            <p className="card-sub">Products responsible for 80% of revenue are marked as top drivers</p>
            {pareto.map((p) => (
              <div className="list-row" key={p.goods_id}>
                <div>
                  <div className="name">{p.goods_name}</div>
                  <div className="meta">
                    {p.units_sold} units · {p.voucher_count} voucher{p.voucher_count === 1 ? '' : 's'} · {p.cumulative_pct}% cumulative
                  </div>
                </div>
                <span className={`tnum chip ${p.is_top_driver ? 'ok' : ''}`} style={!p.is_top_driver ? { background: 'transparent', padding: 0 } : {}}>
                  {money(p.revenue)}
                </span>
              </div>
            ))}
            {pareto.length === 0 && <p className="empty-note">No sales posted yet — insights appear after the first Sales Voucher.</p>}
          </div>
          <div className="card">
            <h3>Best customers</h3>
            <p className="card-sub">Ranked by total revenue this financial year</p>
            {topCustomers.map((c) => (
              <div className="list-row" key={c.account_id}>
                <div>
                  <div className="name">{c.customer_name}</div>
                  <div className="meta">
                    {c.voucher_count} voucher{c.voucher_count === 1 ? '' : 's'} · last bought{' '}
                    {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('en-IN') : '—'}
                  </div>
                </div>
                <span className="tnum">{money(c.total_revenue)}</span>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="empty-note">No customer sales yet.</p>}
          </div>
        </div>
      ) : tab === 'Customer Risk' ? (
        <div className="table-wrap">
          <p className="card-sub" style={{ marginBottom: 10 }}>
            Aging is by transaction age against Sundry Debtors accounts. Risk score blends overdue share with credit-limit utilisation.
          </p>
          <table className="data report">
            <thead>
              <tr>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>0–30 days</th>
                <th style={{ textAlign: 'right' }}>31–60 days</th>
                <th style={{ textAlign: 'right' }}>61–90 days</th>
                <th style={{ textAlign: 'right' }}>90+ days</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((a) => (
                <tr key={a.account_id}>
                  <td className="strong">{a.account_name}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(a.bucket_0_30)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(a.bucket_31_60)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(a.bucket_61_90)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(a.bucket_90_plus)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(a.total_outstanding)}</td>
                  <td>
                    <span className={`chip ${a.risk_level === 'high' ? 'out' : a.risk_level === 'medium' ? 'low' : 'ok'}`}>
                      {a.risk_level === 'none' ? 'No dues' : `${a.risk_level} (${a.risk_score})`}
                    </span>
                  </td>
                </tr>
              ))}
              {aging.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-note">
                    No Sundry Debtor accounts with ledger activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <p className="card-sub" style={{ marginBottom: 10 }}>
            Rule-based checks across every voucher: entries logged well after their voucher date, entries made outside normal
            business hours, and amounts far above the usual for that voucher type.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Date</th>
                <th>Entered by</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={`${a.voucher_type}-${a.voucher_id}`}>
                  <td className="strong">
                    {VOUCHER_LABEL[a.voucher_type] ?? a.voucher_type} {a.voucher_no}
                  </td>
                  <td>{new Date(a.voucher_date).toLocaleDateString('en-IN')}</td>
                  <td>{a.created_by_name ?? '—'}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(a.amount)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ANOMALY_TAGS.filter((t) => a[t.key]).map((t) => (
                        <span key={t.key} className={`chip ${t.cls}`}>
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {anomalies.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-note">
                    Nothing flagged — all recent activity looks normal.
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
