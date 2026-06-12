import { create } from 'zustand'

const GAS_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzowlbCHUpPxToVxVoYwoba52xmDXwA_2jV_mdbunSxfBTtKhDUzakHtZmP5fepMFjl/exec'

// Password is also enforced server-side in the GAS script
const ADMIN_PW = atob('UXdlcnR5QDEyMzQ1')

export interface VisitorRow {
  Timestamp: string
  IP: string
  Country: string
  City: string
  Device: string
  Browser: string
  Page: string
  Referrer: string
  SessionID: string
  Duration: string
  PageLoadTime: string
}

interface AnalyticsState {
  authed: boolean
  loading: boolean
  error: string | null
  total: number
  visitors: VisitorRow[]
  checkPassword: (pw: string) => boolean
  fetchData: () => Promise<void>
  logout: () => void
}

/** JSONP helper — required because GAS doesn't send CORS headers on GET */
function jsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `_cl_cb_${Date.now()}`
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP timeout'))
    }, 12000)

    function cleanup() {
      clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[cb]
      if (script.parentNode) script.parentNode.removeChild(script)
    }

    ;(window as unknown as Record<string, unknown>)[cb] = (data: T) => {
      cleanup()
      resolve(data)
    }

    script.src = `${url}&callback=${cb}`
    script.onerror = () => { cleanup(); reject(new Error('JSONP error')) }
    document.head.appendChild(script)
  })
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  authed: false,
  loading: false,
  error: null,
  total: 0,
  visitors: [],

  checkPassword: (pw: string) => {
    if (pw === ADMIN_PW) {
      set({ authed: true, error: null })
      return true
    }
    set({ error: 'Incorrect password' })
    return false
  },

  fetchData: async () => {
    if (!get().authed) return
    set({ loading: true, error: null })
    try {
      const url = `${GAS_ENDPOINT}?password=${encodeURIComponent(ADMIN_PW)}`
      const res = await jsonp<{ total: number; data: VisitorRow[] }>(url)
      set({ total: res.total, visitors: res.data, loading: false })
    } catch (err) {
      set({ error: 'Failed to load data. Check your connection.', loading: false })
    }
  },

  logout: () => set({ authed: false, visitors: [], total: 0, error: null }),
}))
