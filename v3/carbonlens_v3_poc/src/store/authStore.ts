import { create } from 'zustand'
import { UserProfile } from '../types'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  login: (email: string, password: string) => boolean
  register: (email: string, displayName: string) => void
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

  login: (email: string, _password: string) => {
    const existing = loadUser()
    if (existing && existing.email === email) {
      set({ user: existing, isAuthenticated: true })
      return true
    }
    const user: UserProfile = {
      email,
      displayName: email.split('@')[0],
      tier: 'free',
      createdAt: Date.now(),
    }
    saveUser(user)
    set({ user, isAuthenticated: true })
    return true
  },

  register: (email: string, displayName: string) => {
    const user: UserProfile = {
      email,
      displayName,
      tier: 'free',
      createdAt: Date.now(),
    }
    saveUser(user)
    set({ user, isAuthenticated: true })
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
