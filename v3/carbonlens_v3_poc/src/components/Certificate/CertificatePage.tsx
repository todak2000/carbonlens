/**
 * CertificatePage — landscape A4 CO₂ storage verification certificate.
 * Route: /registry/verify/:assetId
 *
 * Reads from localStorage['carbonlens_certificates'] keyed by assetId.
 * Uses inline styles only — print-safe, no Tailwind dependency.
 * @page size: A4 landscape  (297 × 210 mm)
 */

import type { CertificateRecord } from '../RegistryPanel/RegistryPanel'

// ── Global styles ─────────────────────────────────────────────────────────────

const GLOBAL_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IBM+Plex+Mono:wght@300;400;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body { font-family: 'IBM Plex Sans', sans-serif; background: #f0f4f8; }

@media print {
  @page { size: A4 landscape; margin: 0; }
  body { background: white; }
  .no-print { display: none !important; }
  .cert-outer { box-shadow: none !important; page-break-inside: avoid; }
}
`

// ── Logo (dark version for white background) ──────────────────────────────────

const LOGO_DARK = `<svg width="140" height="28" viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0,2)">
    <circle cx="21" cy="22" r="9" fill="none" stroke="#00b89a" stroke-width="1.8"/>
    <circle cx="21" cy="22" r="3.5" fill="#00b89a"/>
    <circle cx="5"  cy="22" r="5" fill="none" stroke="#00d4b4" stroke-width="1.4" opacity="0.7"/>
    <circle cx="5"  cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
    <circle cx="37" cy="22" r="5" fill="none" stroke="#00d4b4" stroke-width="1.4" opacity="0.7"/>
    <circle cx="37" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
    <line x1="10" y1="22" x2="12.5" y2="22" stroke="#00d4b4" stroke-width="2.2" opacity="0.8"/>
    <line x1="29.5" y1="22" x2="32" y2="22" stroke="#00d4b4" stroke-width="2.2" opacity="0.8"/>
    <circle cx="21" cy="22" r="18" fill="none" stroke="rgba(0,184,154,0.35)" stroke-width="0.9" stroke-dasharray="2.5 3.5"/>
  </g>
  <text x="48" y="23" font-family="IBM Plex Mono,monospace" font-size="19" font-weight="700" fill="#0d1f3c" letter-spacing="0.5">CARBON</text>
  <text x="48" y="40" font-family="IBM Plex Mono,monospace" font-size="19" font-weight="300" fill="#00b89a" letter-spacing="4.5">LENS</text>
</svg>`

// ── Seal SVG (works on white — uses solid stroke colors) ─────────────────────

const SEAL_SVG = (primary: string, gold: string) => `<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${gold}" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  ${Array.from({length: 12}, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    const a2 = ((i + 0.5) / 12) * Math.PI * 2
    const x1 = 40 + Math.cos(a) * 38, y1 = 40 + Math.sin(a) * 38
    const x2 = 40 + Math.cos(a2) * 32, y2 = 40 + Math.sin(a2) * 32
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${gold}" stroke-width="1" opacity="0.5"/>`
  }).join('')}
  <circle cx="40" cy="40" r="35" fill="url(#sg2)" stroke="${primary}" stroke-width="1.2" opacity="0.6"/>
  <circle cx="40" cy="40" r="30" fill="none" stroke="${gold}" stroke-width="0.5" opacity="0.5"/>
  <circle cx="40" cy="40" r="20" fill="none" stroke="${primary}" stroke-width="1" opacity="0.5"/>
  <circle cx="40" cy="40" r="5.5" fill="${primary}" opacity="0.85"/>
  <circle cx="27" cy="40" r="3.5" fill="${primary}" opacity="0.55"/>
  <circle cx="53" cy="40" r="3.5" fill="${primary}" opacity="0.55"/>
  <line x1="30.5" y1="40" x2="34.5" y2="40" stroke="${primary}" stroke-width="2" opacity="0.7"/>
  <line x1="45.5" y1="40" x2="49.5" y2="40" stroke="${primary}" stroke-width="2" opacity="0.7"/>
  <path id="arc-t2" d="M 9 40 A 31 31 0 0 1 71 40" fill="none"/>
  <path id="arc-b2" d="M 9 40 A 31 31 0 0 0 71 40" fill="none"/>
  <text font-family="IBM Plex Mono,monospace" font-size="5.5" font-weight="700" fill="${primary}" opacity="0.8" letter-spacing="2">
    <textPath href="#arc-t2" startOffset="10%">DIGITAL TWIN REGISTRY</textPath>
  </text>
  <text font-family="IBM Plex Mono,monospace" font-size="5.5" font-weight="500" fill="${gold}" opacity="0.7" letter-spacing="1.5">
    <textPath href="#arc-b2" startOffset="18%">CARBONLENS · 2026</textPath>
  </text>
</svg>`

// ── Not-found page ────────────────────────────────────────────────────────────

function NotFound({ assetId }: { assetId: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', padding: 24 }}>
      <style>{GLOBAL_STYLE}</style>
      <div style={{ maxWidth: 480, width: '100%', background: 'white', borderRadius: 16, padding: '48px 40px', textAlign: 'center', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>
        <div dangerouslySetInnerHTML={{ __html: LOGO_DARK }} style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }} />
        <div style={{ width: 56, height: 56, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0d1f3c', margin: '0 0 12px' }}>Certificate Not Found</h1>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 8px', fontSize: 14 }}>
          The certificate <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono,monospace', fontSize: 12 }}>{assetId}</code> was not found or may have been revoked.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, margin: '0 0 32px' }}>
          Certificates are stored locally in the issuing browser and may no longer be available.
        </p>
        <button onClick={() => { window.location.href = '/' }}
          style={{ background: '#00c4a0', color: 'white', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace' }}>
          Back to App
        </button>
      </div>
    </div>
  )
}

// ── Metric tile (light theme) ─────────────────────────────────────────────────

function MetricTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const col = accent ?? '#00c4a0'
  return (
    <div style={{
      borderTop: `2.5px solid ${col}`,
      padding: '8px 12px',
      background: '#f8fafc',
      borderRadius: '0 0 6px 6px',
      border: '1px solid #e2e8f0',
      borderTopColor: col,
    }}>
      <div style={{ fontSize: 7.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0d1f3c', fontFamily: 'IBM Plex Mono,monospace', lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

// ── Main certificate ──────────────────────────────────────────────────────────

export default function CertificatePage({ assetId, embedded }: { assetId: string; embedded?: boolean }) {
  let cert: CertificateRecord | null = null
  try {
    const stored = JSON.parse(localStorage.getItem('carbonlens_certificates') ?? '{}')
    cert = stored[assetId] ?? null
  } catch {
    cert = null
  }

  if (!cert) return <NotFound assetId={assetId} />

  const issueDate = new Date(cert.savedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
  const origin = window.location.origin

  // Color scheme by status
  const scheme = cert.status === 'Verified'
    ? { primary: '#00a884', gold: '#b8963e', badge: '#dcfdf7', badgeText: '#065f46', stripe: '#00c4a0' }
    : cert.status === 'Review Required'
    ? { primary: '#d97706', gold: '#b8963e', badge: '#fffbeb', badgeText: '#92400e', stripe: '#f59e0b' }
    : { primary: '#dc2626', gold: '#94a3b8', badge: '#fef2f2', badgeText: '#991b1b', stripe: '#ef4444' }

  const statusLabel = cert.status === 'Verified'
    ? 'VERIFIED & CERTIFIED'
    : cert.status === 'Review Required'
    ? 'UNDER REVIEW'
    : 'NON-COMPLIANT'

  return (
    <>
      <style>{GLOBAL_STYLE}</style>

      {/* ── Action bar (screen only, hidden in embedded mode) ── */}
      {!embedded && (
        <div className="no-print" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#64748b', letterSpacing: 1 }}>
            CERTIFICATE · {assetId}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => window.print()}
              style={{ background: '#00a884', color: 'white', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: 1 }}
            >
              ↓ DOWNLOAD PDF
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}
            >
              ← Back to App
            </button>
          </div>
        </div>
      )}

      {/* ── Page wrapper ── */}
      <div style={{ minHeight: embedded ? 0 : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: embedded ? 0 : 64, paddingBottom: embedded ? 0 : 40, background: '#f0f4f8' }}>
        <div className="cert-outer" style={{
          width: '100%',
          maxWidth: 1050,
          margin: '0 auto',
          aspectRatio: '297 / 210',
          background: 'white',
          boxShadow: '0 8px 48px rgba(0,0,0,0.12)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* ── Left colour stripe ── */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 6,
            background: `linear-gradient(180deg, ${scheme.gold} 0%, ${scheme.stripe} 50%, ${scheme.gold} 100%)`,
          }}/>

          {/* ── Top accent bar ── */}
          <div style={{
            position: 'absolute', top: 0, left: 6, right: 0, height: 3,
            background: `linear-gradient(90deg, ${scheme.stripe}, ${scheme.gold}, ${scheme.stripe})`,
          }}/>

          {/* ── Subtle watermark ── */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              fontSize: 110, fontWeight: 800, color: 'rgba(0,0,0,0.025)',
              fontFamily: 'IBM Plex Sans,sans-serif', letterSpacing: -4, whiteSpace: 'nowrap',
              transform: 'rotate(-10deg)',
            }}>
              CarbonLens
            </div>
          </div>

          {/* ── Thin outer border ── */}
          <div style={{
            position: 'absolute', inset: 10,
            border: `1px solid rgba(0,0,0,0.06)`,
            borderLeft: `1px solid rgba(0,0,0,0.06)`,
            pointerEvents: 'none',
          }}/>

          {/* ── Main content ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '22px 44px 18px 52px', position: 'relative' }}>

            {/* ── Header row ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>

              {/* Logo */}
              <div dangerouslySetInnerHTML={{ __html: LOGO_DARK }} />

              {/* Centre title */}
              <div style={{ textAlign: 'center', flex: 1, padding: '0 24px' }}>
                <div style={{
                  fontSize: 7.5, fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '0.25em',
                  color: '#94a3b8', textTransform: 'uppercase', marginBottom: 5,
                }}>
                  Digital Twin Registry · Carbon Capture &amp; Storage
                </div>
                <div style={{
                  fontSize: 20, fontFamily: 'Cinzel, Georgia, serif', fontWeight: 700,
                  color: '#0d1f3c', letterSpacing: 1.5, lineHeight: 1.25,
                }}>
                  CERTIFICATE OF STORAGE VERIFICATION
                </div>
                {/* Ornamental divider */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 7 }}>
                  <div style={{ height: 1, width: 50, background: `linear-gradient(90deg, transparent, ${scheme.gold})` }}/>
                  <svg width="8" height="8" viewBox="0 0 10 10"><polygon points="5,0 6.5,3.5 10,3.5 7.5,5.5 8.5,9 5,7 1.5,9 2.5,5.5 0,3.5 3.5,3.5" fill={scheme.gold}/></svg>
                  <div style={{ height: 1, width: 50, background: `linear-gradient(90deg, ${scheme.gold}, transparent)` }}/>
                </div>
              </div>

              {/* Status badge */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  display: 'inline-block', padding: '4px 14px',
                  background: scheme.badge,
                  border: `1.5px solid ${scheme.primary}40`,
                  borderRadius: 20, fontSize: 8.5,
                  fontFamily: 'IBM Plex Mono,monospace', fontWeight: 700,
                  color: scheme.badgeText, letterSpacing: '0.1em',
                }}>
                  {statusLabel}
                </div>
                <div style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 5, fontFamily: 'IBM Plex Mono,monospace' }}>
                  {assetId}
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, display: 'flex', gap: 28 }}>

              {/* LEFT: Cert text + seal */}
              <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
                <div style={{ paddingLeft: 4 }}>
                  <p style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 6 }}>
                    This is to certify that the geological CO₂ storage assessment for
                  </p>
                  <p style={{
                    fontSize: 16, fontFamily: 'Cinzel,Georgia,serif', fontWeight: 600,
                    color: '#0d1f3c', lineHeight: 1.3,
                    borderBottom: `2px solid ${scheme.stripe}30`,
                    paddingBottom: 8, marginBottom: 8,
                  }}>
                    {cert.formationName}
                  </p>
                  <p style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', lineHeight: 1.7 }}>
                    has been evaluated and{' '}
                    <span style={{ color: scheme.primary, fontStyle: 'normal', fontWeight: 600 }}>
                      {cert.status === 'Verified' ? 'certified as compliant' : cert.status === 'Review Required' ? 'flagged for review' : 'found non-compliant'}
                    </span>{' '}
                    with CarbonLens Digital Twin Registry standards.
                  </p>
                </div>

                {/* Seal */}
                <div style={{ display: 'flex', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: SEAL_SVG(scheme.stripe, scheme.gold) }}
                />
              </div>

              {/* RIGHT: Metrics grid */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Row 1: Storage */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  <MetricTile label="Injected CO₂" value={`${cert.storageCapacity.toFixed(2)} Mt`} accent={scheme.stripe} />
                  <MetricTile label="Total Capacity" value={`${cert.totalCapacity.toFixed(2)} Mt`} accent={scheme.stripe} />
                  <MetricTile label="Plume Radius" value={`${cert.plumeRadius.toFixed(0)} m`} accent={scheme.stripe} />
                  <MetricTile label="Project Duration" value={`${cert.projectYears} yrs`} accent={scheme.stripe} />
                </div>

                {/* Row 2: Integrity */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  <MetricTile label="Containment" value={`${(cert.containmentProbability * 100).toFixed(1)}%`} accent={cert.containmentProbability >= 0.85 ? '#00a884' : '#d97706'} />
                  <MetricTile label="Safety Factor" value={cert.safetyFactor.toFixed(2)} accent={cert.safetyFactor >= 1.2 ? '#00a884' : '#d97706'} />
                  <MetricTile label="Inj. Pressure" value={`${cert.injectionPressure.toFixed(1)} MPa`} accent="#3b82f6" />
                  <MetricTile label="MAIP Margin" value={`${cert.maipMargin.toFixed(1)}%`} accent={cert.maipMargin > 20 ? '#00a884' : '#d97706'} />
                </div>

                {/* Row 3: Trapping + credits */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                  <MetricTile label="Residual Trap." value={`${cert.residualTrapping.toFixed(2)} Mt`} accent="#8b5cf6" />
                  <MetricTile label="Solubility Trap." value={`${cert.solubilityTrapping.toFixed(2)} Mt`} accent="#8b5cf6" />
                  <MetricTile label="Carbon Credits" value={cert.totalCredits.toFixed(0)} accent={scheme.gold} />
                  <MetricTile label="Jurisdiction" value={cert.jurisdiction} accent={scheme.gold} />
                </div>

              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              marginTop: 12, paddingTop: 10,
              borderTop: `1px solid #e2e8f0`,
            }}>
              {/* Left: issuer */}
              <div>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#0d1f3c', letterSpacing: '0.05em', marginBottom: 2 }}>
                  Issued by CarbonLens Digital Twin Registry
                </div>
                <div style={{ fontSize: 7.5, color: '#94a3b8', fontFamily: 'IBM Plex Mono,monospace' }}>
                  {origin}/registry/verify/{cert.assetId}
                </div>
              </div>

              {/* Centre: formation metadata */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 7.5, color: '#94a3b8', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: 0.8 }}>
                  {cert.depth} m depth · {cert.area} km² · φ {(cert.porosity * 100).toFixed(1)}%
                </div>
              </div>

              {/* Right: signature + date */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ borderBottom: `1px solid #cbd5e1`, width: 160, marginBottom: 4, marginLeft: 'auto' }}/>
                <div style={{ fontSize: 7.5, color: '#64748b', fontFamily: 'IBM Plex Mono,monospace' }}>
                  Date Issued: {issueDate}
                </div>
                <div style={{ fontSize: 7, color: '#94a3b8', fontFamily: 'IBM Plex Mono,monospace', marginTop: 1 }}>
                  CarbonLens Simulation Studio v3
                </div>
              </div>
            </div>

          </div>{/* /main content */}

        </div>{/* /cert-outer */}
      </div>
    </>
  )
}
