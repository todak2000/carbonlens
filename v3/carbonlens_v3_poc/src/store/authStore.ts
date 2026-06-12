import { create } from 'zustand'
import { UserProfile } from '../types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  login: (email: string) => boolean
  register: (email: string, displayName: string, organization: string) => void
  loginAsDemo: () => void
  logout: () => void
  hydrate: () => void
}

function saveUser(user: UserProfile): void {
  localStorage.setItem('carbonlens_user', JSON.stringify(user))
}

function loadUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem('carbonlens_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: (email: string) => {
    const existing = loadUser()
    if (existing && existing.email === email) {
      set({ user: existing, isAuthenticated: true })
      return true
    }
    return false
  },

  register: (email: string, displayName: string, organization: string) => {
    const user: UserProfile = {
      email,
      displayName,
      organization,
      tier: 'free',
      createdAt: Date.now(),
    }
    saveUser(user)
    set({ user, isAuthenticated: true })
  },

  loginAsDemo: () => {
    // Ephemeral guest session — not persisted to localStorage
    const demoUser: UserProfile = {
      email: 'demo@carbonlens',
      displayName: 'Demo Guest',
      organization: 'CarbonLens',
      tier: 'free',
      createdAt: Date.now(),
    }
    set({ user: demoUser, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('carbonlens_user')
    set({ user: null, isAuthenticated: false })
  },

  hydrate: () => {
    const user = loadUser()
    if (user) set({ user, isAuthenticated: true })
  },
}))
