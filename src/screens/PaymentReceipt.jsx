import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PaymentReceipt() {
  const { profile, canAdd } = useAuth()
  const [mode, setMode] = useState('payment') // or 'receipt'
  const [cashBankAccounts, setCashBankAccounts] = useState([])
  const [otherAccounts, setOtherAccounts] = useState([])
  const [cashBankId, setCashBankId] = useState('')
  const [otherId, setOtherId] = useState('')
  const [amount, setAmount] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [narration, setNarration] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const canPay = canAdd('payment_voucher')
  const canReceive = canAdd('receipt_voucher')

  useEffect(() => {
    async function load() {
      const { data: cashBank } = await supabase.from('accounts').select('id, name').in('system_role', ['cash', 'bank']).order('name')
      setCashBankAccounts(cashBank ?? [])
      const { data: others } = await supabase.from('accounts').select('id, name').is('system_role', null).order('name')
      setOtherAccounts(others ?? [])
    }
    load()
  }, [])

  useEffect(() => {
    if (mode === 'receipt' && !canReceive && canPay) setMode('payment')
    if (mode === 'payment' && !canPay && canReceive) setMode('receipt')
  }, [canPay, canReceive, mode])

  async function handleSubmit() {
    setError(null)
    setResult(null)
    if (!cashBankId || !otherId || !amount || Number(amount) <= 0) {
      setError('Fill in the account and a positive amount.')
      return
    }
    setSubmitting(true)
    const fn = mode === 'payment' ? 'create_payment_voucher' : 'create_receipt_voucher'
    const payload =
      mode === 'payment'
        ? {
            p_branch_id: profile.home_branch_id,
            p_voucher_date: new Date().toISOString().slice(0, 10),
            p_paid_by_account_id: cashBankId,
            p_pay_to_account_id: otherId,
            p_amount: Number(amount),
            p_cheque_no: chequeNo || null,
            p_narration: narration || null,
          }
        : {
            p_branch_id: profile.home_branch_id,
            p_voucher_date: new Date().toISOString().slice(0, 10),
            p_receive_by_account_id: cashBankId,
            p_receive_from_account_id: otherId,
            p_amount: Number(amount),
            p_cheque_no: chequeNo || null,
            p_narration: narration || null,
          }
    const { data, error } = await supabase.rpc(fn, payload)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    setResult(row)
    setAmount('')
    setChequeNo('')
    setNarration('')
    setOtherId('')
  }

  if (!canPay && !canReceive) {
    return (
      <section>
        <div className="page-head">
          <h1>Payment / Receipt</h1>
        </div>
        <p className="empty-note">Your account doesn't have permission to record payments or receipts.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Payment / Receipt</h1>
          <p className="sub">Posts a balanced pair of entries to ledger_entries</p>
        </div>
      </div>

      <div className="tab-row">
        {canPay && (
          <button className={`tab${mode === 'payment' ? ' active' : ''}`} onClick={() => setMode('payment')}>
            Payment (money out)
          </button>
        )}
        {canReceive && (
          <button className={`tab${mode === 'receipt' ? ' active' : ''}`} onClick={() => setMode('receipt')}>
            Receipt (money in)
          </button>
        )}
      </div>

      {result && (
        <div className="login-hint" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)', padding: 12, borderRadius: 9, marginBottom: 16 }}>
          Voucher <strong>{result.voucher_no}</strong> posted successfully.
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="field" style={{ marginTop: 0 }}>
          <label>{mode === 'payment' ? 'Paid from (cash/bank)' : 'Received into (cash/bank)'}</label>
          <select value={cashBankId} onChange={(e) => setCashBankId(e.target.value)}>
            <option value="">Select account…</option>
            {cashBankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{mode === 'payment' ? 'Paid to' : 'Received from'}</label>
          <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            <option value="">Select account…</option>
            {otherAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label>Cheque No. (optional)</label>
            <input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Narration (optional)</label>
          <input value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Posting…' : `Post ₹${money(amount || 0)}`}
        </button>
      </div>
    </section>
  )
}
