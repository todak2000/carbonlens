import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import Logo from '../Logo'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const setView = useUIStore((s) => s.setView)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'login') {
      const success = login(email)
      if (success) setView('dashboard')
    } else {
      register(email, name || email.split('@')[0], organization)
      setView('dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-1">
            <Logo width={220} />
          </div>
          <p className="text-muted text-xs font-mono tracking-wider uppercase">Storage Studio</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode === 'login' && (
            <p className="text-muted text-xs font-mono text-center">
              Enter your registered email to continue
            </p>
          )}
          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Organization / Company"
                required
                className="input-field"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </>
          )}
          <button type="submit" className="btn-primary w-full flex items-center justify-center">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          <p className="text-center text-muted text-xs font-mono">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </form>
        <div className="text-center mt-4">
          <button
            onClick={() => setView('landing')}
            className="text-[11px] text-muted hover:text-primary font-mono transition"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
