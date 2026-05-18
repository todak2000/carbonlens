import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import AuthScreen from './components/Auth/AuthScreen'
import Dashboard from './components/Dashboard'
import MainLayout from './components/Layout/MainLayout'
import LandingPage from './components/Landing/LandingPage'

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hydrate = useAuthStore((s) => s.hydrate)
  const theme = useUIStore((s) => s.theme)
  const view = useUIStore((s) => s.view)
  const setView = useUIStore((s) => s.setView)

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Route: landing → auth → dashboard → workspace
  if (view === 'landing') return <LandingPage />
  if (!isAuthenticated) return <AuthScreen />
  if (view === 'dashboard') return <Dashboard />
  return <MainLayout />
}
