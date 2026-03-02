import { useState } from 'react'
import { Modal, Field } from './UI'
import { ASSET_CATS, LIABILITY_CATS, INCOME_CATS, EXPENSE_CATS } from '../utils/constants'
import { CURRENCIES } from '../utils/constants'
import { uid } from '../utils/helpers'
import { useFinance } from '../context/FinanceContext'

const CATS = {
  assets:      ASSET_CATS,
  liabilities: LIABILITY_CATS,
  income:      INCOME_CATS,
  expenses:    EXPENSE_CATS,
}

const PLACEHOLDER_NAME = {
  assets:      'e.g. HDFC Savings Account',
  liabilities: 'e.g. SBI Home Loan',
  income:      'e.g. Monthly Salary',
  expenses:    'e.g. Rent / EMI',
}

export default function EntryModal({ collection, item, onClose, onSaved }) {
  const { addItem, updateItem, settings } = useFinance()
  const isEdit    = Boolean(item?.id)
  const cats      = CATS[collection]
  const isCF      = collection === 'income' || collection === 'expenses'
  const isLiab    = collection === 'liabilities'
  const currSymbol = CURRENCIES.find(c => c.code === settings.currency)?.symbol || '₹'

  const [form, setForm] = useState({
    name:        item?.name        || '',
    category:    item?.category    || cats[0],
    value:       item?.value       || '',
    monthly:     item?.monthly     || '',
    institution: item?.institution || '',
    rate:        item?.rate        || '',
    note:        item?.note        || '',
  })
  const [saving, setSaving] = useState(false)

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 200))

    const entry = {
      id:          item?.id || uid(),
      name:        form.name.trim(),
      category:    form.category,
      institution: form.institution.trim(),
      note:        form.note.trim(),
      ...(isCF
        ? { monthly: parseFloat(form.monthly) || 0 }
        : { value:   parseFloat(form.value)   || 0 }),
      ...(isLiab && form.rate ? { rate: parseFloat(form.rate) } : {}),
    }

    if (isEdit) updateItem(collection, entry)
    else        addItem(collection, entry)

    setSaving(false)
    onSaved?.()
    onClose()
  }

  const title = `${isEdit ? 'Edit' : 'Add'} ${collection.charAt(0).toUpperCase() + collection.slice(1, -1)}`

  return (
    <Modal title={title} onClose={onClose}>
      <div>
        <Field label="Name / Description">
          <input className="input" value={form.name} onChange={e => f('name', e.target.value)}
            placeholder={PLACEHOLDER_NAME[collection]} autoFocus />
        </Field>

        <Field label="Category">
          <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        {isCF ? (
          <Field label={`Monthly Amount (${currSymbol})`}>
            <input className="input" type="number" min="0" value={form.monthly}
              onChange={e => f('monthly', e.target.value)} placeholder="0" />
          </Field>
        ) : (
          <Field label={`${isLiab ? 'Outstanding Balance' : 'Current Value'} (${currSymbol})`}>
            <input className="input" type="number" min="0" value={form.value}
              onChange={e => f('value', e.target.value)} placeholder="0" />
          </Field>
        )}

        {!isCF && (
          <Field label="Institution / Provider">
            <input className="input" value={form.institution}
              onChange={e => f('institution', e.target.value)}
              placeholder="e.g. SBI, HDFC, Zerodha…" />
          </Field>
        )}

        {isLiab && (
          <Field label="Interest Rate (% p.a.)">
            <input className="input" type="number" min="0" max="100" step="0.1"
              value={form.rate} onChange={e => f('rate', e.target.value)}
              placeholder="e.g. 8.5" />
          </Field>
        )}

        <Field label="Note (optional)">
          <input className="input" value={form.note}
            onChange={e => f('note', e.target.value)}
            placeholder="Any relevant notes…"
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving
              ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>↻</span>
              : null}
            {isEdit ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
