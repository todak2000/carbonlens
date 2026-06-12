import { useState, useEffect, useMemo } from 'react'
import { useAnalyticsStore, VisitorRow } from '../../store/analyticsStore'
import { useUIStore } from '../../store/uiStore'

// ── Tiny helpers ────────────────────────────────────────────────────────────

function count<T extends string>(arr: T[]): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1
    return acc
  }, {})
}

function topN(rec: Record<string, number>, n = 5): [string, number][] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

function fmtDuration(sec: string | number): string {
  const s = Number(sec)
  if (!s || s < 0) return '—'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

// ── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate() {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const checkPassword = useAnalyticsStore((s) => s.checkPassword)
  const error = useAnalyticsStore((s) => s.error)
  const setView = useUIStore((s) => s.setView)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    checkPassword(pw)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-emerald-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Analytics</h1>
          <p className="text-xs text-[var(--text-muted)]">Admin access only</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              className="w-full px-4 py-3 pr-10 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {show
                ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </p>
          )}

          <button type="submit"
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition">
            Unlock Dashboard
          </button>
        </form>

        <button onClick={() => setView('landing')}
          className="mt-5 w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
          ← Back to app
        </button>
      </div>
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string | undefined }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Bar List ─────────────────────────────────────────────────────────────────

function BarList({ title, items }: { title: string; items: [string, number][] }) {
  const max = items[0]?.[1] ?? 1
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-3">{title}</p>
      <ul className="space-y-2">
        {items.map(([label, n]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] w-28 truncate shrink-0">{label || '—'}</span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-xs text-[var(--text-muted)] w-6 text-right shrink-0">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Visitor Table ─────────────────────────────────────────────────────────────

const COLS: { key: keyof VisitorRow; label: string; fmt?: (v: string) => string }[] = [
  { key: 'Timestamp', label: 'Time', fmt: (v) => v ? new Date(v).toLocaleString() : '—' },
  { key: 'Country', label: 'Country' },
  { key: 'City', label: 'City' },
  { key: 'Device', label: 'Device' },
  { key: 'Browser', label: 'Browser' },
  { key: 'Page', label: 'Page' },
  { key: 'Referrer', label: 'Referrer', fmt: (v) => v === 'direct' ? 'Direct' : (v ? new URL(v).hostname : '—') },
  { key: 'Duration', label: 'Duration', fmt: fmtDuration },
]

function VisitorTable({ rows }: { rows: VisitorRow[] }) {
  const [page, setPage] = useState(0)
  const PER = 20
  const total = rows.length
  const slice = rows.slice(page * PER, (page + 1) * PER)
  const pages = Math.ceil(total / PER)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Recent Visitors</p>
        <span className="text-[10px] text-[var(--text-muted)]">{total} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {COLS.map((c) => (
                <th key={c.key}
                  className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-primary)]/40 transition">
                {COLS.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap max-w-[180px] truncate">
                    {c.fmt ? c.fmt(row[c.key]) : (row[c.key] || '—')}
                  </td>
                ))}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-8 text-center text-[var(--text-muted)] text-xs">
                  No visitor records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-30 transition">
            ← Prev
          </button>
          <span className="text-[10px] text-[var(--text-muted)]">Page {page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-30 transition">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const authed = useAnalyticsStore((s) => s.authed)
  const loading = useAnalyticsStore((s) => s.loading)
  const error = useAnalyticsStore((s) => s.error)
  const total = useAnalyticsStore((s) => s.total)
  const visitors = useAnalyticsStore((s) => s.visitors)
  const fetchData = useAnalyticsStore((s) => s.fetchData)
  const logout = useAnalyticsStore((s) => s.logout)
  const setView = useUIStore((s) => s.setView)
  const [hideDevSessions, setHideDevSessions] = useState(true)

  // ── Derived stats — must be declared before any early return ──────────────
  const devSessionCount = useMemo(
    () => visitors.filter((v) => v.Country === 'Development').length,
    [visitors]
  )

  const filteredVisitors = useMemo(
    () => hideDevSessions ? visitors.filter((v) => v.Country !== 'Development') : visitors,
    [visitors, hideDevSessions]
  )

  const uniqueSessions = useMemo(
    () => new Set(filteredVisitors.map((v) => v.SessionID)).size,
    [filteredVisitors]
  )
  const avgDuration = useMemo(() => {
    const valid = filteredVisitors.map((v) => Number(v.Duration)).filter((d) => d > 0)
    if (!valid.length) return 0
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  }, [filteredVisitors])

  const topCountries = useMemo(() => topN(count(filteredVisitors.map((v) => v.Country || 'Unknown'))), [filteredVisitors])
  const topDevices   = useMemo(() => topN(count(filteredVisitors.map((v) => v.Device || 'Unknown'))), [filteredVisitors])
  const topBrowsers  = useMemo(() => topN(count(filteredVisitors.map((v) => v.Browser || 'Unknown'))), [filteredVisitors])
  const topPages     = useMemo(() => topN(count(filteredVisitors.map((v) => v.Page || '/'))), [filteredVisitors])
  const topReferrers = useMemo(() => {
    const refs = filteredVisitors.map((v) => {
      if (!v.Referrer || v.Referrer === 'direct') return 'Direct'
      try { return new URL(v.Referrer).hostname } catch { return v.Referrer }
    })
    return topN(count(refs))
  }, [filteredVisitors])

  useEffect(() => {
    if (authed) fetchData()
  }, [authed, fetchData])

  if (!authed) return <PasswordGate />

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('landing')}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 className="font-semibold text-sm">Visitor Analytics</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideDevSessions}
              onChange={(e) => setHideDevSessions(e.target.checked)}
              className="w-3 h-3 accent-emerald-500"
            />
            <span className="text-xs text-[var(--text-muted)]">Hide Dev Sessions</span>
            {devSessionCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">
                {devSessionCount} hidden
              </span>
            )}
          </label>
          <button onClick={fetchData} disabled={loading}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition flex items-center gap-1.5 disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={logout}
            className="text-xs text-[var(--text-muted)] hover:text-red-400 transition">
            Sign out
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {loading && !visitors.length ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-muted)] text-sm gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
            Loading analytics data…
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Visits" value={filteredVisitors.length} sub={hideDevSessions && devSessionCount > 0 ? `${devSessionCount} dev sessions hidden` : undefined} />
              <StatCard label="Unique Sessions" value={uniqueSessions} />
              <StatCard label="Avg Duration" value={fmtDuration(avgDuration)} />
              <StatCard label="Countries" value={topCountries.length} />
            </div>

            {/* Bar lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <BarList title="Top Countries" items={topCountries} />
              <BarList title="Devices" items={topDevices} />
              <BarList title="Browsers" items={topBrowsers} />
              <BarList title="Top Pages" items={topPages} />
              <BarList title="Referrers" items={topReferrers} />
            </div>

            {/* Table */}
            <VisitorTable rows={filteredVisitors} />
          </>
        )}
      </div>
    </div>
  )
}
