import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatMoney as fmtMoney } from '../lib/money'

export default function Dashboard() {
  const { profile } = useAuth()
  const country = profile?.organizations?.country || 'IN'
  function formatMoney(n) {
    return fmtMoney(n, country)
  }
  const [loading, setLoading] = useState(true)
  const [todaySales, setTodaySales] = useState(0)
  const [lowStock, setLowStock] = useState([])
  const [recentVouchers, setRecentVouchers] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)

      const salesReq = supabase
        .from('ledger_entries')
        .select('credit, accounts!inner(system_role)')
        .eq('accounts.system_role', 'sales')
        .eq('voucher_date', today)

      const stockReq = supabase
        .from('goods_with_stock')
        .select('goods_id, goods_name, current_qty, reorder_qty')
        .not('reorder_qty', 'is', null)

      const vouchersReq = supabase
        .from('sales_vouchers')
        .select('voucher_no, total, customer_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      const [{ data: salesRows }, { data: stockRows }, { data: voucherRows }] = await Promise.all([
        salesReq,
        stockReq,
        vouchersReq,
      ])
      if (cancelled) return

      setTodaySales((salesRows ?? []).reduce((sum, r) => sum + Number(r.credit), 0))
      setLowStock((stockRows ?? []).filter((g) => Number(g.current_qty) <= Number(g.reorder_qty)))
      setRecentVouchers(voucherRows ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (profile?.full_name || '').split(' ')[0] || 'there'

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Good day, {firstName}</h1>
          <p className="sub">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {profile?.branches?.name}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="empty-note">Loading live data…</p>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi">
              <span className="lbl">Today's sales</span>
              <span className="val tnum">{formatMoney(todaySales)}</span>
              <span className="delta">From ledger_entries, live</span>
            </div>
            <div className="kpi">
              <span className="lbl">Low / out of stock</span>
              <span className="val tnum">{lowStock.length}</span>
              <span className="delta down">{lowStock.filter((g) => Number(g.current_qty) <= 0).length} out of stock</span>
            </div>
            <div className="kpi">
              <span className="lbl">Recent vouchers</span>
              <span className="val tnum">{recentVouchers.length}</span>
              <span className="delta">Most recent 5 shown below</span>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Recent activity</h3>
              <p className="card-sub">From sales_vouchers, live</p>
              {recentVouchers.length === 0 && <p className="empty-note">No sales recorded yet.</p>}
              {recentVouchers.map((v) => (
                <div className="activity-item" key={v.voucher_no}>
                  <span className="dot"></span>
                  <div>
                    <p>
                      <strong>Sales Voucher {v.voucher_no}</strong>
                      {v.customer_name ? ` — ${v.customer_name}` : ''} — {formatMoney(v.total)}
                    </p>
                    <span className="t">{new Date(v.created_at).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3>Needs attention</h3>
              <p className="card-sub">From stock_ledger + goods.reorder_qty, live</p>
              {lowStock.length === 0 && <p className="empty-note">Everything is above its reorder level.</p>}
              {lowStock.map((g) => (
                <div className="list-row" key={g.goods_id}>
                  <div>
                    <div className="name">{g.goods_name}</div>
                    <div className="meta">
                      Reorder at {g.reorder_qty} · now {g.current_qty}
                    </div>
                  </div>
                  <span className={`chip ${Number(g.current_qty) <= 0 ? 'out' : 'low'}`}>
                    {Number(g.current_qty) <= 0 ? 'Out' : 'Low'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
