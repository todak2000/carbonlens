import { useEffect, useState } from 'react'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import AuthScreen from './components/Auth/AuthScreen'
import Dashboard from './components/Dashboard'
import MainLayout from './components/Layout/MainLayout'
import LandingPage from './components/Landing/LandingPage'
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard'
import CertificatePage from './components/Certificate/CertificatePage'
import MobileGuard from './components/MobileGuard'
import { trackVisit, trackDuration } from './utils/visitorTracker'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrate = useAuthStore((s) => s.hydrate)
  const theme = useUIStore((s) => s.theme)
  const view = useUIStore((s) => s.view)
  const [certId, setCertId] = useState<string | null>(null)

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Track visitor on first mount; record duration on unload
  useEffect(() => {
    trackVisit()
    window.addEventListener('beforeunload', trackDuration)
    return () => window.removeEventListener('beforeunload', trackDuration)
  }, [])

  // Detect certificate route: /registry/verify/CL-XXXX-XX-XXXX
  useEffect(() => {
    const match = window.location.pathname.match(
      /^\/registry\/verify\/(CL-[0-9A-Fa-f]{4}-[0-9]{2}-[0-9]{3,4})$/
    )
    if (match) {
      setCertId(match[1])
    }
  }, [])

  // Certificate route takes priority over all other routes
  if (certId) return <CertificatePage assetId={certId} />

  // Route: landing → auth → dashboard → workspace | analytics (admin-only)
  // Landing page is accessible on all devices; all other views require desktop
  if (view === 'analytics') return <MobileGuard><AnalyticsDashboard /></MobileGuard>
  if (view === 'landing') return <LandingPage />
  if (!isAuthenticated) return <MobileGuard><AuthScreen /></MobileGuard>
  if (view === 'dashboard') return <MobileGuard><Dashboard /></MobileGuard>
  return <MobileGuard><MainLayout /></MobileGuard>
}
