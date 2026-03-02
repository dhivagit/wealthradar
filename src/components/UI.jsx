import { useEffect } from 'react'
import { formatCurrency, formatCompact } from '../utils/helpers'

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color, change, icon, delay = 0 }) {
  return (
    <div className="card card-glow fade-up" style={{ padding: '22px 24px', animationDelay: `${delay}ms`, opacity: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#6b7494', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
        {icon && <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>}
      </div>
      <div className="stat-number" style={{ fontSize: 28, color: color || '#e2e4ec', lineHeight: 1.1, marginBottom: 6 }}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {sub && <span style={{ fontSize: 12, color: '#6b7494' }}>{sub}</span>}
        {change !== undefined && (
          <span style={{ fontSize: 12, color: change >= 0 ? '#3ecf8e' : '#f06a6a', fontFamily: "'JetBrains Mono',monospace" }}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color = '#c8953a', height = 5 }) {
  return (
    <div className="progress-track" style={{ height }}>
      <div className="progress-fill" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: wide ? 680 : 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
export function Field({ label, children, span2 = true }) {
  return (
    <div style={{ marginBottom: 18, gridColumn: span2 ? 'span 2' : 'span 1' }}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

// ── Notification toast ────────────────────────────────────────────────────────
export function Notification({ msg, type = 'info', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [onDone])
  const colors = { success: '#3ecf8e', error: '#f06a6a', info: '#5b8ff9', warning: '#f09b46' }
  const icons  = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }
  return (
    <div className="notification">
      <span style={{ color: colors[type], fontSize: 16, fontWeight: 600 }}>{icons[type]}</span>
      <span style={{ color: '#e2e4ec' }}>{msg}</span>
    </div>
  )
}

// ── Custom Recharts Tooltip ───────────────────────────────────────────────────
export function ChartTooltip({ active, payload, label, currency = 'INR' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0d1117', border: '1px solid #1a1f2e', borderRadius: 10, padding: '12px 16px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
      <div style={{ color: '#6b7494', marginBottom: 8 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 3 }}>
          {p.name}: <span style={{ color: '#e2e4ec' }}>{formatCompact(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}

// ── SVG Donut ─────────────────────────────────────────────────────────────────
export function DonutSVG({ segments, size = 130, thick = 26 }) {
  const r     = (size - thick) / 2
  const cx    = size / 2, cy = size / 2
  const circ  = 2 * Math.PI * r
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  let off = 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1f2e" strokeWidth={thick} />
      {segments.map((s, i) => {
        const dash = (s.value / total) * circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
            strokeWidth={thick - 2} strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-(off / total) * circ} strokeLinecap="round" opacity={0.9} />
        )
        off += s.value
        return el
      })}
    </svg>
  )
}

// ── Data Table ────────────────────────────────────────────────────────────────
export function DataTable({ cols, rows, onEdit, onDelete, currency = 'INR' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {cols.map(c => <th key={c.key} style={{ textAlign: c.right ? 'right' : 'left' }}>{c.label}</th>)}
            <th style={{ width: 110 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + 1} style={{ textAlign: 'center', color: '#3d4460', padding: '36px 16px' }}>
                No entries yet. Add one above.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id} className="fade-up" style={{ animationDelay: `${i * 30}ms`, opacity: 0 }}>
              {cols.map(c => (
                <td key={c.key} style={{ textAlign: c.right ? 'right' : 'left', color: c.color ? c.color(row) : '#e2e4ec', fontFamily: c.mono ? "'JetBrains Mono',monospace" : 'inherit' }}>
                  {c.render ? c.render(row, currency) : (row[c.key] ?? '—')}
                </td>
              ))}
              <td style={{ textAlign: 'right' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => onEdit(row)} style={{ marginRight: 4 }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(row.id)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
