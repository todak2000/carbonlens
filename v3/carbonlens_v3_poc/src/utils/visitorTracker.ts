const GAS_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzowlbCHUpPxToVxVoYwoba52xmDXwA_2jV_mdbunSxfBTtKhDUzakHtZmP5fepMFjl/exec'

export function isLocalhost(): boolean {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.')
}

function getSessionId(): string {
  const key = 'cl_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem(key, sid)
  }
  return sid
}

function detectDevice(): string {
  const ua = navigator.userAgent
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    if (/iPad/i.test(ua)) return 'tablet'
    return 'mobile'
  }
  return 'desktop'
}

function detectBrowser(): string {
  const ua = navigator.userAgent
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua)) return 'Opera'
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari'
  return 'Other'
}

function getPageLoadTime(): number {
  try {
    const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (entry) return Math.round(entry.loadEventEnd - entry.startTime)
  } catch {}
  return 0
}

let _sessionStart = Date.now()

export async function trackVisit(): Promise<void> {
  _sessionStart = Date.now()

  // Geo lookup — ipwho.is has CORS headers enabled (free, no API key)
  // Skip geo fetch on localhost/dev to avoid blank country in analytics
  let ip = ''
  let country = ''
  let city = ''
  if (isLocalhost()) {
    ip = '127.0.0.1'
    country = 'Development'
    city = 'Local'
  } else {
    try {
      const geo = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) })
      if (geo.ok) {
        const j = await geo.json()
        ip = j.ip ?? ''
        country = j.country ?? ''
        city = j.city ?? ''
      }
    } catch {}
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ip,
    country,
    city,
    device: detectDevice(),
    browser: detectBrowser(),
    page: window.location.pathname + window.location.hash,
    referrer: document.referrer || 'direct',
    sessionId: getSessionId(),
    duration: 0,
    pageLoadTime: getPageLoadTime(),
  }

  try {
    await fetch(GAS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {}
}

export function trackDuration(): void {
  const sessionId = getSessionId()
  const duration = Math.round((Date.now() - _sessionStart) / 1000)

  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    ip: '',
    country: '',
    city: '',
    device: detectDevice(),
    browser: detectBrowser(),
    page: window.location.pathname + window.location.hash,
    referrer: document.referrer || 'direct',
    sessionId,
    duration,
    pageLoadTime: 0,
  })

  // sendBeacon is reliable on page unload; falls back to sync XHR
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    navigator.sendBeacon(GAS_ENDPOINT, blob)
  }
}
