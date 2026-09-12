import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatAmount, currencySymbol } from '../lib/money'

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Reports() {
  const { canView, profile } = useAuth()
  const country = profile?.organizations?.country || 'IN'
  const isUS = country === 'US'
  const sym = currencySymbol(country)
  function money(n) {
    return formatAmount(n, country)
  }

  const TABS = [
    'Trial Balance',
    'Profit & Loss',
    'Balance Sheet',
    'Account Ledger',
    'Day Book',
    ...(isUS ? ['Sales Tax Liability'] : ['GST Sales Register', 'GST Purchase Register', 'HSN Summary']),
    'Aging',
  ]
  const DATE_RANGE_TABS = [
    'Account Ledger',
    'Day Book',
    ...(isUS ? ['Sales Tax Liability'] : ['GST Sales Register', 'GST Purchase Register', 'HSN Summary']),
  ]

  const [tab, setTab] = useState('Trial Balance')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [ledgerAccountId, setLedgerAccountId] = useState('')
  const [ledgerRows, setLedgerRows] = useState([])
  const [fyLabel, setFyLabel] = useState('')
  const [fromDate, setFromDate] = useState(startOfMonth())
  const [toDate, setToDate] = useState(today())
  const [dayBookRows, setDayBookRows] = useState([])
  const [dayBookLoading, setDayBookLoading] = useState(false)
  const [agingRows, setAgingRows] = useState([])
  const [agingLoading, setAgingLoading] = useState(false)
  const [gstSalesRows, setGstSalesRows] = useState([])
  const [gstSalesLoading, setGstSalesLoading] = useState(false)
  const [gstPurchaseRows, setGstPurchaseRows] = useState([])
  const [gstPurchaseLoading, setGstPurchaseLoading] = useState(false)
  const [usTaxRows, setUsTaxRows] = useState([])
  const [usTaxLoading, setUsTaxLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('v_trial_balance').select('*').order('group_name').order('account_name')
      setRows(data ?? [])
      if (data?.[0]) setFyLabel(data[0].financial_year_label)
      const { data: acctRows } = await supabase.from('accounts').select('id, name').order('name')
      setAccounts(acctRows ?? [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadLedger() {
      if (!ledgerAccountId) {
        setLedgerRows([])
        return
      }
      const { data } = await supabase
        .from('ledger_entries')
        .select('voucher_date, voucher_type, voucher_id, debit, credit, narration, created_at')
        .eq('account_id', ledgerAccountId)
        .order('voucher_date')
        .order('created_at')
      setLedgerRows(data ?? [])
    }
    loadLedger()
  }, [ledgerAccountId])

  useEffect(() => {
    if (tab !== 'Day Book') return
    async function loadDayBook() {
      setDayBookLoading(true)
      const { data } = await supabase
        .from('ledger_entries')
        .select('voucher_date, voucher_type, voucher_id, debit, credit, narration, created_at, accounts(name)')
        .gte('voucher_date', fromDate)
        .lte('voucher_date', toDate)
        .order('voucher_date')
        .order('created_at')
      setDayBookRows(data ?? [])
      setDayBookLoading(false)
    }
    loadDayBook()
  }, [tab, fromDate, toDate])

  useEffect(() => {
    if (tab !== 'GST Sales Register' && tab !== 'HSN Summary') return
    async function loadGstSales() {
      setGstSalesLoading(true)
      const { data } = await supabase
        .from('v_gst_sales_register')
        .select('*')
        .gte('voucher_date', fromDate)
        .lte('voucher_date', toDate)
        .order('voucher_date')
        .order('voucher_no')
      setGstSalesRows(data ?? [])
      setGstSalesLoading(false)
    }
    loadGstSales()
  }, [tab, fromDate, toDate])

  useEffect(() => {
    if (tab !== 'GST Purchase Register') return
    async function loadGstPurchase() {
      setGstPurchaseLoading(true)
      const { data } = await supabase
        .from('v_gst_purchase_register')
        .select('*')
        .gte('voucher_date', fromDate)
        .lte('voucher_date', toDate)
        .order('voucher_date')
        .order('voucher_no')
      setGstPurchaseRows(data ?? [])
      setGstPurchaseLoading(false)
    }
    loadGstPurchase()
  }, [tab, fromDate, toDate])

  useEffect(() => {
    if (tab !== 'Sales Tax Liability') return
    async function loadUsTax() {
      setUsTaxLoading(true)
      const { data } = await supabase
        .from('v_us_sales_tax_register')
        .select('*')
        .gte('voucher_date', fromDate)
        .lte('voucher_date', toDate)
        .order('voucher_date')
        .order('voucher_no')
      setUsTaxRows(data ?? [])
      setUsTaxLoading(false)
    }
    loadUsTax()
  }, [tab, fromDate, toDate])

  const usTaxByState = useMemo(() => {
    const map = {}
    for (const r of usTaxRows) {
      const key = r.state_code ?? '—'
      if (!map[key]) {
        map[key] = { state_code: r.state_code, taxable_value: 0, tax_amount: 0, total: 0 }
      }
      const m = map[key]
      m.taxable_value += Number(r.taxable_value)
      m.tax_amount += Number(r.tax_amount)
      m.total += Number(r.total)
    }
    return Object.values(map).sort((a, b) => (a.state_code ?? '').localeCompare(b.state_code ?? ''))
  }, [usTaxRows])

  const hsnSummary = useMemo(() => {
    const map = {}
    for (const r of gstSalesRows) {
      const key = `${r.hsn_sac_code ?? '—'}|${r.tax_pct}|${r.uom ?? ''}`
      if (!map[key]) {
        map[key] = {
          hsn_sac_code: r.hsn_sac_code,
          tax_pct: r.tax_pct,
          uom: r.uom,
          qty: 0,
          taxable_value: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
          tax_amount: 0,
          total: 0,
        }
      }
      const m = map[key]
      m.qty += Number(r.qty)
      m.taxable_value += Number(r.taxable_value)
      m.cgst_amount += Number(r.cgst_amount)
      m.sgst_amount += Number(r.sgst_amount)
      m.igst_amount += Number(r.igst_amount)
      m.tax_amount += Number(r.tax_amount)
      m.total += Number(r.total)
    }
    return Object.values(map).sort((a, b) => (a.hsn_sac_code ?? '').localeCompare(b.hsn_sac_code ?? ''))
  }, [gstSalesRows])

  useEffect(() => {
    if (tab !== 'Aging') return
    async function loadAging() {
      setAgingLoading(true)
      const { data } = await supabase
        .from('v_account_group_aging')
        .select('*')
        .order('party_type')
        .order('total_outstanding', { ascending: false })
      setAgingRows(data ?? [])
      setAgingLoading(false)
    }
    loadAging()
  }, [tab])

  const withClosing = rows.map((r) => ({
    ...r,
    debitTotal: Number(r.opening_debit) + Number(r.period_debit),
    creditTotal: Number(r.opening_credit) + Number(r.period_credit),
    closing: Number(r.closing_balance),
  }))

  const trialTotal = withClosing.reduce(
    (acc, r) => ({ debit: acc.debit + r.debitTotal, credit: acc.credit + r.creditTotal }),
    { debit: 0, credit: 0 }
  )

  const incomeRows = withClosing.filter((r) => r.transaction_type === 'income')
  const expenseRows = withClosing.filter((r) => r.transaction_type === 'expense')
  const totalIncome = incomeRows.reduce((s, r) => s - r.closing, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.closing, 0)
  const netProfit = totalIncome - totalExpense

  const assetRows = withClosing.filter((r) => r.transaction_type === 'assets')
  const liabilityRows = withClosing.filter((r) => r.transaction_type === 'liabilities')
  const capitalRows = withClosing.filter((r) => r.transaction_type === 'capital')
  const totalAssets = assetRows.reduce((s, r) => s + r.closing, 0)
  const totalLiabilities = liabilityRows.reduce((s, r) => s - r.closing, 0)
  const totalCapital = capitalRows.reduce((s, r) => s - r.closing, 0)

  const selectedAccountRow = withClosing.find((r) => r.account_id === ledgerAccountId)
  const openingForRange = useMemo(() => {
    const fyOpening = selectedAccountRow ? Number(selectedAccountRow.opening_debit) - Number(selectedAccountRow.opening_credit) : 0
    const beforeFrom = ledgerRows
      .filter((r) => r.voucher_date < fromDate)
      .reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0)
    return fyOpening + beforeFrom
  }, [selectedAccountRow, ledgerRows, fromDate])

  const ledgerInRange = ledgerRows.filter((r) => r.voucher_date >= fromDate && r.voucher_date <= toDate)
  let running = openingForRange
  const ledgerWithBalance = ledgerInRange.map((r) => {
    running += Number(r.debit) - Number(r.credit)
    return { ...r, runningBalance: running }
  })

  const dayBookTotals = dayBookRows.reduce(
    (acc, r) => ({ debit: acc.debit + Number(r.debit), credit: acc.credit + Number(r.credit) }),
    { debit: 0, credit: 0 }
  )

  const customerAging = agingRows.filter((r) => r.party_type === 'customer')
  const supplierAging = agingRows.filter((r) => r.party_type === 'supplier')

  if (!canView('reports')) {
    return (
      <section>
        <div className="page-head">
          <h1>Reports</h1>
        </div>
        <p className="empty-note">Your account doesn't have permission to view reports.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="sub">{fyLabel || 'Current financial year'} — live from ledger_entries</p>
        </div>
      </div>

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {DATE_RANGE_TABS.includes(tab) && (
        <div className="toolbar" style={{ gap: 12, flexWrap: 'wrap' }}>
          {tab === 'Account Ledger' && (
            <select className="select-box" value={ledgerAccountId} onChange={(e) => setLedgerAccountId(e.target.value)}>
              <option value="">Select an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <div className="field" style={{ marginTop: 0 }}>
            <label>From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginTop: 0 }}>
            <label>To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      )}

      {loading ? (
        <p className="empty-note">Loading…</p>
      ) : tab === 'Trial Balance' ? (
        <div className="table-wrap">
          <table className="data report">
            <thead>
              <tr>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {withClosing.map((r) => (
                <tr key={r.account_id}>
                  <td>{r.account_name}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {r.closing > 0 ? money(r.closing) : '—'}
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {r.closing < 0 ? money(-r.closing) : '—'}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="total-row">Total</td>
                <td className="num total-row" style={{ textAlign: 'right' }}>
                  {money(trialTotal.debit)}
                </td>
                <td className="num total-row" style={{ textAlign: 'right' }}>
                  {money(trialTotal.credit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : tab === 'Profit & Loss' ? (
        <div className="table-wrap">
          <table className="data report">
            <thead>
              <tr>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="grp-row" colSpan={2}>
                  Income
                </td>
              </tr>
              {incomeRows.map((r) => (
                <tr key={r.account_id}>
                  <td>{r.account_name}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {money(-r.closing)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="grp-row" colSpan={2}>
                  Expenses
                </td>
              </tr>
              {expenseRows.map((r) => (
                <tr key={r.account_id}>
                  <td>{r.account_name}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {money(r.closing)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="total-row">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</td>
                <td className="num total-row" style={{ textAlign: 'right', color: netProfit >= 0 ? 'var(--accent-strong)' : 'var(--red)' }}>
                  {money(Math.abs(netProfit))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : tab === 'Balance Sheet' ? (
        <div className="grid-2">
          <div className="card">
            <h3>Assets</h3>
            {assetRows.map((r) => (
              <div className="list-row" key={r.account_id}>
                <div className="name">{r.account_name}</div>
                <span className="tnum">{sym}{money(r.closing)}</span>
              </div>
            ))}
            <div className="summary-row total">
              <span>Total Assets</span>
              <span className="val tnum">{sym}{money(totalAssets)}</span>
            </div>
          </div>
          <div className="card">
            <h3>Liabilities &amp; Capital</h3>
            {liabilityRows.map((r) => (
              <div className="list-row" key={r.account_id}>
                <div className="name">{r.account_name}</div>
                <span className="tnum">{sym}{money(-r.closing)}</span>
              </div>
            ))}
            {capitalRows.map((r) => (
              <div className="list-row" key={r.account_id}>
                <div className="name">{r.account_name}</div>
                <span className="tnum">{sym}{money(-r.closing)}</span>
              </div>
            ))}
            <div className="list-row">
              <div className="name">Current Year Earnings</div>
              <span className="tnum">{sym}{money(netProfit)}</span>
            </div>
            <div className="summary-row total">
              <span>Total Liabilities &amp; Capital</span>
              <span className="val tnum">{sym}{money(totalLiabilities + totalCapital + netProfit)}</span>
            </div>
          </div>
        </div>
      ) : tab === 'Account Ledger' ? (
        <div>
          {!ledgerAccountId ? (
            <p className="empty-note">Pick an account to see its ledger.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher</th>
                    <th>Narration</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="strong">
                      Opening balance
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {money(Math.abs(openingForRange))} {openingForRange >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                  {ledgerWithBalance.map((r, i) => (
                    <tr key={i}>
                      <td>{r.voucher_date}</td>
                      <td>{r.voucher_type.replace('_', ' ')}</td>
                      <td>{r.narration ?? '—'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {Number(r.debit) > 0 ? money(r.debit) : '—'}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {Number(r.credit) > 0 ? money(r.credit) : '—'}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {money(Math.abs(r.runningBalance))} {r.runningBalance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  ))}
                  {ledgerInRange.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-note">
                        No entries for this account in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'Day Book' ? (
        <div className="table-wrap">
          {dayBookLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Account</th>
                  <th>Narration</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {dayBookRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.voucher_date}</td>
                    <td>{r.voucher_type.replace('_', ' ')}</td>
                    <td>{r.accounts?.name ?? '—'}</td>
                    <td>{r.narration ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {Number(r.debit) > 0 ? money(r.debit) : '—'}
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {Number(r.credit) > 0 ? money(r.credit) : '—'}
                    </td>
                  </tr>
                ))}
                {dayBookRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-note">
                      No vouchers posted in this date range.
                    </td>
                  </tr>
                )}
                {dayBookRows.length > 0 && (
                  <tr>
                    <td colSpan={4} className="total-row">
                      Total
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(dayBookTotals.debit)}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(dayBookTotals.credit)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === 'GST Sales Register' ? (
        <div className="table-wrap">
          {gstSalesLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <table className="data report">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Party</th>
                  <th>GSTIN</th>
                  <th>HSN/SAC</th>
                  <th style={{ textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {gstSalesRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.voucher_date}</td>
                    <td className="strong">
                      {r.voucher_no}
                      {r.voucher_type === 'Sales Return' && <div className="sub" style={{ fontSize: '.7rem' }}>Return</div>}
                    </td>
                    <td>{r.party_name ?? '—'}</td>
                    <td>{r.party_gstin ?? '— (B2C)'}</td>
                    <td>{r.hsn_sac_code ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.taxable_value)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{r.tax_pct}%</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.cgst_amount)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.sgst_amount)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.igst_amount)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.total)}</td>
                  </tr>
                ))}
                {gstSalesRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="empty-note">No sales in this date range.</td>
                  </tr>
                )}
                {gstSalesRows.length > 0 && (
                  <tr>
                    <td colSpan={5} className="total-row">Total</td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstSalesRows.reduce((s, r) => s + Number(r.taxable_value), 0))}
                    </td>
                    <td className="total-row"></td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstSalesRows.reduce((s, r) => s + Number(r.cgst_amount), 0))}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstSalesRows.reduce((s, r) => s + Number(r.sgst_amount), 0))}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstSalesRows.reduce((s, r) => s + Number(r.igst_amount), 0))}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstSalesRows.reduce((s, r) => s + Number(r.total), 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === 'GST Purchase Register' ? (
        <div className="table-wrap">
          {gstPurchaseLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <table className="data report">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher</th>
                  <th>Party</th>
                  <th>GSTIN</th>
                  <th>HSN/SAC</th>
                  <th style={{ textAlign: 'right' }}>Taxable Value</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>CGST</th>
                  <th style={{ textAlign: 'right' }}>SGST</th>
                  <th style={{ textAlign: 'right' }}>IGST</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {gstPurchaseRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.voucher_date}</td>
                    <td className="strong">
                      {r.voucher_no}
                      {r.voucher_type === 'Purchase Return' && <div className="sub" style={{ fontSize: '.7rem' }}>Return</div>}
                    </td>
                    <td>{r.party_name ?? '—'}</td>
                    <td>{r.party_gstin ?? '—'}</td>
                    <td>{r.hsn_sac_code ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.taxable_value)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{r.tax_pct}%</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.cgst_amount)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.sgst_amount)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.igst_amount)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{money(r.total)}</td>
                  </tr>
                ))}
                {gstPurchaseRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="empty-note">No purchases in this date range.</td>
                  </tr>
                )}
                {gstPurchaseRows.length > 0 && (
                  <tr>
                    <td colSpan={5} className="total-row">Total</td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstPurchaseRows.reduce((s, r) => s + Number(r.taxable_value), 0))}
                    </td>
                    <td className="total-row"></td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstPurchaseRows.reduce((s, r) => s + Number(r.cgst_amount), 0))}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstPurchaseRows.reduce((s, r) => s + Number(r.sgst_amount), 0))}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstPurchaseRows.reduce((s, r) => s + Number(r.igst_amount), 0))}
                    </td>
                    <td className="num total-row" style={{ textAlign: 'right' }}>
                      {money(gstPurchaseRows.reduce((s, r) => s + Number(r.total), 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : tab === 'HSN Summary' ? (
        <div className="table-wrap">
          {gstSalesLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <>
              <p className="card-sub" style={{ padding: '12px 16px 0' }}>
                Outward supplies (sales) grouped by HSN/SAC and tax rate — matches the HSN summary section of GSTR-1.
              </p>
              <table className="data report">
                <thead>
                  <tr>
                    <th>HSN/SAC</th>
                    <th>UOM</th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnSummary.map((h, i) => (
                    <tr key={i}>
                      <td className="strong">{h.hsn_sac_code ?? '—'}</td>
                      <td>{h.uom ?? '—'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{h.qty}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{h.tax_pct}%</td>
                      <td className="num" style={{ textAlign: 'right' }}>{money(h.taxable_value)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{money(h.cgst_amount)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{money(h.sgst_amount)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{money(h.igst_amount)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{money(h.tax_amount)}</td>
                    </tr>
                  ))}
                  {hsnSummary.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-note">No sales in this date range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : tab === 'Sales Tax Liability' ? (
        <div className="table-wrap">
          {usTaxLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <>
              <p className="card-sub" style={{ padding: '12px 16px 0' }}>
                Taxable sales and tax collected by state for this date range — a starting point for filing each state's
                sales tax return. Rates come from the tax rates set up under Organization &amp; Branch Setup.
              </p>
              <table className="data report">
                <thead>
                  <tr>
                    <th>State</th>
                    <th style={{ textAlign: 'right' }}>Taxable Sales</th>
                    <th style={{ textAlign: 'right' }}>Tax Collected</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {usTaxByState.map((s, i) => (
                    <tr key={i}>
                      <td className="strong">{s.state_code ?? 'No state / exempt'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{sym}{money(s.taxable_value)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{sym}{money(s.tax_amount)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{sym}{money(s.total)}</td>
                    </tr>
                  ))}
                  {usTaxByState.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-note">No sales in this date range.</td>
                    </tr>
                  )}
                  {usTaxByState.length > 0 && (
                    <tr>
                      <td className="total-row">Total</td>
                      <td className="num total-row" style={{ textAlign: 'right' }}>
                        {sym}{money(usTaxByState.reduce((s, r) => s + r.taxable_value, 0))}
                      </td>
                      <td className="num total-row" style={{ textAlign: 'right' }}>
                        {sym}{money(usTaxByState.reduce((s, r) => s + r.tax_amount, 0))}
                      </td>
                      <td className="num total-row" style={{ textAlign: 'right' }}>
                        {sym}{money(usTaxByState.reduce((s, r) => s + r.total, 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : (
        <div>
          {agingLoading ? (
            <p className="empty-note">Loading…</p>
          ) : (
            <div className="grid-2">
              <div>
                <h3 style={{ marginBottom: 8 }}>Customers owe you (Sundry Debtors)</h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'right' }}>0-30d</th>
                        <th style={{ textAlign: 'right' }}>31-60d</th>
                        <th style={{ textAlign: 'right' }}>61-90d</th>
                        <th style={{ textAlign: 'right' }}>90d+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerAging.map((r) => (
                        <tr key={r.account_id}>
                          <td>{r.account_name}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.total_outstanding)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_0_30)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_31_60)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_61_90)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_90_plus)}</td>
                        </tr>
                      ))}
                      {customerAging.length === 0 && (
                        <tr>
                          <td colSpan={6} className="empty-note">No outstanding customer balances.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 style={{ marginBottom: 8 }}>You owe suppliers (Sundry Creditors)</h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'right' }}>0-30d</th>
                        <th style={{ textAlign: 'right' }}>31-60d</th>
                        <th style={{ textAlign: 'right' }}>61-90d</th>
                        <th style={{ textAlign: 'right' }}>90d+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierAging.map((r) => (
                        <tr key={r.account_id}>
                          <td>{r.account_name}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.total_outstanding)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_0_30)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_31_60)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_61_90)}</td>
                          <td className="num" style={{ textAlign: 'right' }}>{money(r.bucket_90_plus)}</td>
                        </tr>
                      ))}
                      {supplierAging.length === 0 && (
                        <tr>
                          <td colSpan={6} className="empty-note">No outstanding supplier balances.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
