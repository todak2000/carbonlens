import { useEffect, useState } from 'react'
import { useUIStore } from '../store/uiStore'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const WHITEPAPER_URL = `${BASE}/whitepaper.html`

function isMobile() {
  return window.innerWidth < 768
}

interface MobileGuardProps {
  children: React.ReactNode
}

export default function MobileGuard({ children }: MobileGuardProps) {
  const setView = useUIStore((s) => s.setView)
  const [mobile, setMobile] = useState(() => isMobile())

  useEffect(() => {
    const handler = () => setMobile(isMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!mobile) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
      <svg width="140" viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg" className="mb-8">
        <g transform="translate(0,2)">
          <circle cx="21" cy="22" r="9" fill="none" stroke="#00b89a" strokeWidth="1.8"/>
          <circle cx="21" cy="22" r="3.5" fill="#00b89a"/>
          <circle cx="5" cy="22" r="5" fill="none" stroke="#00d4b4" strokeWidth="1.4" opacity="0.7"/>
          <circle cx="5" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
          <circle cx="37" cy="22" r="5" fill="none" stroke="#00d4b4" strokeWidth="1.4" opacity="0.7"/>
          <circle cx="37" cy="22" r="1.8" fill="#00d4b4" opacity="0.7"/>
          <line x1="10" y1="22" x2="12.5" y2="22" stroke="#00d4b4" strokeWidth="2.2" opacity="0.8"/>
          <line x1="29.5" y1="22" x2="32" y2="22" stroke="#00d4b4" strokeWidth="2.2" opacity="0.8"/>
          <circle cx="21" cy="22" r="18" fill="none" stroke="rgba(0,184,154,0.22)" strokeWidth="0.9" strokeDasharray="2.5 3.5"/>
        </g>
        <text x="48" y="23" fontFamily="monospace" fontSize="19" fontWeight="700" fill="white" letterSpacing="0.5">CARBON</text>
        <text x="48" y="40" fontFamily="monospace" fontSize="19" fontWeight="300" fill="#00b89a" letterSpacing="4.5">LENS</text>
      </svg>

      {/* Monitor icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#0d9488]/10 border border-[#0d9488]/30 flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>

      <h1 className="text-white text-xl font-bold mb-3 tracking-tight">Desktop Required</h1>
      <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-8">
        The CarbonLens simulation workspace is optimised for desktop use and requires a screen width of at least 768px. Please open this link on a laptop or desktop computer.
      </p>

      <div className="w-full max-w-xs space-y-3">
        <a
          href={WHITEPAPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-[#0d9488] text-white text-sm font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Read Technical White Paper
        </a>
        <button
          onClick={() => setView('landing')}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm font-medium"
        >
          Back to Landing Page
        </button>
      </div>

      <p className="mt-10 text-slate-600 text-xs font-mono tracking-wider uppercase">
        CarbonLens · CO&#8322; Storage Simulation Studio
      </p>
    </div>
  )
}
