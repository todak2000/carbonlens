import { useRef, useEffect } from 'react'
import { useFormationStore } from '../../store/formationStore'
import { useSimulationStore } from '../../store/simulationStore'
import { useUIStore } from '../../store/uiStore'
import type { SimulationResult } from '../../types'

interface Props { fullScreen?: boolean }

// Virtual coordinate space
const PW = 400, PH = 260

// X mapping: 3D world [-1.5, 1.5] → virtual canvas [40, 360]
const X_MIN_3D = -1.5, X_MAX_3D = 1.5
const X_CANVAS_MIN = 40, X_CANVAS_MAX = 360
function mapX(x3d: number) {
  return X_CANVAS_MIN + ((x3d - X_MIN_3D) / (X_MAX_3D - X_MIN_3D)) * (X_CANVAS_MAX - X_CANVAS_MIN)
}

// Top strip and bottom limit in virtual units
const PSURF_Y = 14
const DRAW_BOT = PH - 8

const PEVENTS = [
  { t: 0.3, cls: 'good' as const, msg: 'CO₂ injection started — supercritical conditions' },
  { t: 2,   cls: '' as const,     msg: 'Buoyancy migration: CO₂ rises toward caprock' },
  { t: 6,   cls: 'good' as const, msg: 'Caprock reached — IFT controls capillary seal' },
  { t: 12,  cls: '' as const,     msg: 'Amber = residual trapping (permanently immobilised)' },
  { t: 19,  cls: 'good' as const, msg: 'Blue = dissolution trapping — CO₂ into brine' },
  { t: 35,  cls: 'warn' as const, msg: 'AoR expanding — cross-reference leakage risk' },
  { t: 50,  cls: 'good' as const, msg: 'Year 50 — permanent trapping secures the site' },
]

// Static grain positions within [0,1] — mapped to actual reservoir band each frame
const PGRAIN = Array.from({ length: 300 }, () => ({
  xr: Math.random(), yr: Math.random(), s: 0.5 + Math.random() * 0.7,
}))

// ── Simulation-derived physics parameters ──────────────────────────────────────
interface SimSnapshot {
  drho: number
  visc: number
  solubility: number
  trappingRate: number
  residualFrac: number
  dissolveFrac: number
  totalInjected: number
  totalCapacity: number
}

function makeSnapshot(result: SimulationResult): SimSnapshot {
  const total = result.residualTrapping + result.solubilityTrapping + Math.max(result.mobilePlume, 0.01)
  return {
    drho: result.densityDiff || 200,
    visc: result.co2Viscosity || 5e-5,
    solubility: result.solubility || 0.03,
    trappingRate: total > 0.001 ? (result.residualTrapping + result.solubilityTrapping) / Math.max(result.storageCapacity, 0.001) * 0.02 : 0.02,
    residualFrac: total > 0.001 ? result.residualTrapping / total : 0.35,
    dissolveFrac: total > 0.001 ? result.solubilityTrapping / total : 0.15,
    totalInjected: result.storageCapacity,
    totalCapacity: result.totalCapacity,
  }
}

// ── Particle class ────────────────────────────────────────────────────────────
class PPart {
  x: number; y: number
  vx: number; vy: number
  s: 'free' | 'cap' | 'residual' | 'dissolved'
  a: number; r: number; age: number
  wellWx: number
  baseDrho: number

  constructor(wx: number, pcapb: number, presb: number, drho: number) {
    this.wellWx = wx
    this.baseDrho = drho
    this.x = wx + (Math.random() - 0.5) * 5
    this.y = presb - 5 - Math.random() * Math.max(10, (presb - pcapb) * 0.7)
    this.vx = (Math.random() - 0.5) * 0.18
    this.vy = -(1.0 + Math.random() * 0.6) * Math.max(0.5, drho / 200)
    this.s = 'free'
    this.a = 1
    this.r = 1.5 + Math.random() * 1.3
    this.age = 0
  }

  step(dt: number, pcapb: number, presb: number, sim: SimSnapshot | null) {
    const drhoFactor = sim ? Math.max(0.5, sim.drho / 200) : 1
    const tr = sim ? Math.max(0.005, sim.trappingRate) : 0.02
    const resFrac = sim ? sim.residualFrac : 0.35
    const disFrac = sim ? sim.dissolveFrac : 0.15
    this.age += dt
    if (this.s === 'dissolved') {
      this.y += 0.08 * drhoFactor * 0.3 * dt
      this.a = Math.max(0, this.a - 0.00015 * dt * (sim ? sim.solubility / 0.03 : 1))
      if (this.y > presb - 4) this.y = presb - 4
      return
    }
    if (this.s === 'residual') return
    if (this.s === 'cap') {
      this.x += this.vx * dt
      this.vx += (Math.random() - 0.5) * 0.018 * dt
      this.vx *= 0.993
      if (this.x < 16) this.vx = Math.abs(this.vx) * 0.8
      if (this.x > PW - 16) this.vx = -Math.abs(this.vx) * 0.8
      // Transition to residual: faster when trapping rate is higher
      if (this.age > 6 && Math.random() < tr * 0.08 * dt * (1 + resFrac * 2)) {
        this.s = 'residual'; this.vx = 0; this.vy = 0
        this.y = pcapb + 5 + Math.random() * Math.min(36, (presb - pcapb) * 0.5)
      }
      // Transition to dissolved: driven by solubility trapping efficiency
      if (this.age > 10 && Math.random() < tr * 0.06 * dt * (1 + disFrac * 2)) {
        this.s = 'dissolved'
        this.vx = (Math.random() - 0.5) * 0.12
        this.vy = 0.08 * drhoFactor * 0.3
      }
      return
    }
    // free — buoyant rise: velocity scales with density difference
    this.vy -= 0.008 * drhoFactor * dt
    this.vy = Math.max(this.vy, -2.0 * drhoFactor)
    this.vx += (Math.random() - 0.5) * 0.045 * dt
    this.vx *= 0.979
    this.x += this.vx * dt
    this.y += this.vy * dt
    if (this.y <= pcapb + 2) {
      this.y = pcapb + 2
      this.s = 'cap'; this.vy = 0
      this.vx = (this.x > this.wellWx ? 1 : -1) * (0.04 + Math.random() * 0.12 * drhoFactor)
    }
    if (this.x < 10) this.vx = Math.abs(this.vx)
    if (this.x > PW - 10) this.vx = -Math.abs(this.vx)
    if (this.y > presb - 4) this.y = presb - 4
  }

  // No shadowBlur — clean sharp dot with a soft translucent halo
  draw(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
    if (this.a < 0.02) return
    const cx = this.x * sx, cy = this.y * sy
    const cr = this.r * Math.min(sx, sy)
    const haloColor  = this.s === 'free' ? '#00c4a0' : this.s === 'cap' ? '#00ffe0' : this.s === 'residual' ? '#f0a030' : '#3787da'
    const coreColor  = this.s === 'free' ? '#00eedd' : this.s === 'cap' ? '#60fff4' : this.s === 'residual' ? '#f5a830' : 'rgba(55,135,218,0.75)'
    ctx.save()
    // Halo — large, transparent, no blur
    ctx.globalAlpha = this.a * 0.18
    ctx.beginPath(); ctx.arc(cx, cy, cr * 2.4, 0, Math.PI * 2)
    ctx.fillStyle = haloColor; ctx.fill()
    // Core — sharp, fully opaque
    ctx.globalAlpha = this.a * 0.88
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.fillStyle = coreColor; ctx.fill()
    ctx.restore()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CrossSection({ fullScreen = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logRef    = useRef<HTMLDivElement>(null)
  const partsRef  = useRef<PPart[]>([])
  const pInjFracRef    = useRef(0)
  const evTriggeredRef = useRef<Set<number>>(new Set())
  const rafRef    = useRef(0)
  const lastTsRef = useRef(0)

  useEffect(() => {
    if (logRef.current) logRef.current.innerHTML = ''
    evTriggeredRef.current = new Set()

    const loop = (ts: number) => {
      const c = canvasRef.current
      if (!c) { rafRef.current = requestAnimationFrame(loop); return }
      rafRef.current = requestAnimationFrame(loop)
      const ctx = c.getContext('2d')
      if (!ctx) return

      const dpr  = window.devicePixelRatio || 1
      const cssW = c.offsetWidth  || PW
      const cssH = c.offsetHeight || PH
      // Only resize the backing store when CSS size changes (avoids clearing canvas every frame)
      if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
        c.width  = Math.round(cssW * dpr)
        c.height = Math.round(cssH * dpr)
      }
      // Scale all drawing operations to physical pixels → crisp on Retina/HiDPI
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const CW = cssW, CH = cssH
      const sx = CW / PW, sy = CH / PH

      const params     = useFormationStore.getState().params
      const wells      = useFormationStore.getState().wells
      const result     = useSimulationStore.getState().result
      const pTime      = useUIStore.getState().timestep
      const isAnimating = useSimulationStore.getState().isAnimating

      // ── DYNAMIC LAYER POSITIONS from formation params ─────────────────
      // Estimate caprock thickness (no dedicated param — use 7% of depth, min 20 m)
      const caprockThickM = Math.max(20, params.depth * 0.07)
      const caprockTopM   = params.depth - caprockThickM   // depth to top of caprock
      const reservoirTopM = params.depth                    // injection depth = top of reservoir
      const reservoirBotM = params.depth + params.thickness // bottom of reservoir

      // Proportional canvas allocation (keeps diagram readable at any depth):
      //   Overburden: 38%  |  Caprock + Reservoir: 52%  |  Basement: 10%
      const DRAW_H   = DRAW_BOT - PSURF_Y           // total drawable virtual height
      const OVERB_H  = DRAW_H * 0.38
      const BASEM_H  = DRAW_H * 0.10
      const MID_H    = DRAW_H - OVERB_H - BASEM_H

      const capResTotalM = caprockThickM + params.thickness
      const caprockFrac  = caprockThickM / capResTotalM
      const resFrac      = params.thickness  / capResTotalM

      const pcapt = PSURF_Y + OVERB_H                 // caprock top (virtual y)
      const pcapb = pcapt + MID_H * caprockFrac        // caprock bottom = reservoir top
      const presb = pcapb + MID_H * resFrac            // reservoir bottom

      // ── STEP PARTICLES ────────────────────────────────────────────────
      const maxParts = fullScreen ? 1200 : 800
      const simSnap = result ? makeSnapshot(result) : null
      if (isAnimating && pTime < 50) {
        if (!lastTsRef.current) lastTsRef.current = ts
        const dtms = Math.min(ts - lastTsRef.current, 50)
        lastTsRef.current = ts
        const dty = dtms / 1000 * 0.28
        pInjFracRef.current += 5 * dty
        while (pInjFracRef.current >= 1 && partsRef.current.length < maxParts) {
          const widx = Math.floor(Math.random() * Math.max(1, wells.length))
          const wx   = mapX(wells[widx]?.x ?? 0)
          const drho = result?.densityDiff ?? 200
          partsRef.current.push(new PPart(wx, pcapb, presb, drho))
          pInjFracRef.current -= 1
        }
        const pd = dtms / 1000 * 3.5
        for (const p of partsRef.current) p.step(pd, pcapb, presb, simSnap)

        // Fire events
        for (const ev of PEVENTS) {
          if (!evTriggeredRef.current.has(ev.t) && pTime >= ev.t) {
            evTriggeredRef.current.add(ev.t)
            const lg = logRef.current
            if (lg) {
              const el = document.createElement('div')
              const borderColor = ev.cls === 'good' ? '#00c4a0' : ev.cls === 'warn' ? '#f0a030' : '#243040'
              el.style.cssText = `
                padding:3px 4px;border-left:2px solid ${borderColor};
                background:rgba(0,0,0,0.3);font-size:${fullScreen ? '8px' : '6px'};
                line-height:1.3;margin-bottom:2px;opacity:0;transition:opacity 0.4s ease;
                color:${ev.cls === 'good' ? '#00c4a0' : ev.cls === 'warn' ? '#f0a030' : '#6090a0'};
              `
              el.innerHTML = `<span style="opacity:0.7;font-size:${fullScreen ? '7px' : '5px'}">Yr ${ev.t.toFixed(1)}</span> ${ev.msg}`
              lg.insertBefore(el, lg.firstChild)
              requestAnimationFrame(() => { el.style.opacity = '1' })
            }
          }
        }
      } else {
        lastTsRef.current = 0
      }

      // ── CLEAR ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CW, CH)

      // ── LAYERS ─────────────────────────────────────────────────────────
      // Surface strip
      const surfG = ctx.createLinearGradient(0, 0, 0, PSURF_Y * sy)
      surfG.addColorStop(0, '#020508'); surfG.addColorStop(1, '#040810')
      ctx.fillStyle = surfG; ctx.fillRect(0, 0, CW, PSURF_Y * sy)

      // Overburden
      const ovG = ctx.createLinearGradient(0, PSURF_Y * sy, 0, pcapt * sy)
      ovG.addColorStop(0, '#040c14'); ovG.addColorStop(0.5, '#060f1a'); ovG.addColorStop(1, '#08121e')
      ctx.fillStyle = ovG; ctx.fillRect(0, PSURF_Y * sy, CW, (pcapt - PSURF_Y) * sy)

      // Overburden strata — deterministic jitter from sin so no flicker
      for (let y = PSURF_Y + 5; y < pcapt - 2; y += 8) {
        ctx.strokeStyle = 'rgba(140,180,255,0.018)'; ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(CW, (y + Math.sin(y * 7.3) * 1.5) * sy); ctx.stroke()
      }

      // Caprock
      const capG = ctx.createLinearGradient(0, pcapt * sy, 0, pcapb * sy)
      capG.addColorStop(0, '#0d0b14'); capG.addColorStop(0.5, '#0f0c18'); capG.addColorStop(1, '#100d1a')
      ctx.fillStyle = capG; ctx.fillRect(0, pcapt * sy, CW, (pcapb - pcapt) * sy)

      // Caprock tight strata
      for (let y = pcapt + 2; y < pcapb - 1; y += 1.8) {
        ctx.strokeStyle = 'rgba(120,90,160,0.06)'; ctx.lineWidth = 0.4
        ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(CW, (y + Math.sin(y * 13.7) * 0.5) * sy); ctx.stroke()
      }

      // Reservoir — warm golden-brown sandstone
      const resG = ctx.createLinearGradient(0, pcapb * sy, 0, presb * sy)
      resG.addColorStop(0, '#1c1508'); resG.addColorStop(0.5, '#221a0a'); resG.addColorStop(1, '#181206')
      ctx.fillStyle = resG; ctx.fillRect(0, pcapb * sy, CW, (presb - pcapb) * sy)

      // Pressure field overlay in reservoir
      if (result?.pressureField && pTime > 0) {
        const field = result.pressureField
        const baseP = params.pressure
        const maxDP = 12
        const fieldRes = Math.round(Math.sqrt(field.length))
        function sampleP(mx: number): number {
          const px = (mx / CW) * PW
          let closest = baseP, minD = Infinity
          for (const pt of field) {
            const d2 = (pt.x * sx - px * sx) ** 2 + (pt.z * sy - 0) ** 2
            const d = Math.sqrt(d2) || 0
            if (d < minD) { minD = d; closest = pt.pressure }
          }
          return closest
        }
        for (let ix = 0; ix < CW - 1; ix += 2) {
          const px = ix / sx
          if (px < 0 || px > PW) continue
          const pVal = sampleP(ix)
          const frac = Math.max(0, Math.min(1, (pVal - baseP) / maxDP))
          const r = frac, gv = Math.max(0, 1 - frac * 1.8), b = Math.max(0, 1 - frac * 1.5)
          ctx.fillStyle = `rgba(${r * 255 | 0},${gv * 255 | 0},${b * 255 | 0},0.15)`
          ctx.fillRect(ix, pcapb * sy, 2, (presb - pcapb) * sy)
        }
        // Pressure contour lines (isobars)
        for (let pMPa = Math.ceil(baseP + 0.5); pMPa < baseP + maxDP; pMPa += 1) {
          const contourPoints: number[] = []
          for (let ix = 0; ix < CW; ix += 3) {
            const px = ix / sx
            if (px < 0 || px > PW) continue
            const pVal = sampleP(ix)
            if (Math.abs(pVal - pMPa) < 0.5) {
              contourPoints.push(ix)
            }
          }
          if (contourPoints.length > 4) {
            ctx.strokeStyle = `rgba(255,100,50,${0.08 + (pMPa - baseP) / maxDP * 0.15})`
            ctx.lineWidth = 0.5
            ctx.setLineDash([2, 3])
            ctx.beginPath()
            for (let i = 0; i < contourPoints.length - 1; i++) {
              const midY = (pcapb + (presb - pcapb) * 0.3 + Math.sin(contourPoints[i] * 0.02 + pMPa) * (presb - pcapb) * 0.25) * sy
              if (i === 0) ctx.moveTo(contourPoints[i], midY)
              else ctx.lineTo(contourPoints[i + 1], midY)
            }
            ctx.stroke()
            ctx.setLineDash([])
            // Label the contour
            const labelX = contourPoints[Math.floor(contourPoints.length / 3)]
            ctx.fillStyle = 'rgba(255,100,50,0.4)'
            ctx.font = `${5 * sx}px monospace`
            ctx.textAlign = 'center'
            ctx.fillText(`${pMPa} MPa`, labelX, (pcapb + (presb - pcapb) * 0.08) * sy)
          }
        }
      }

      // Sandstone grain texture
      ctx.fillStyle = 'rgba(190,150,45,0.028)'
      for (const g of PGRAIN) {
        ctx.beginPath()
        ctx.arc(g.xr * CW, pcapb * sy + g.yr * (presb - pcapb) * sy, g.s * Math.min(sx, sy), 0, Math.PI * 2)
        ctx.fill()
      }

      // Brine saturation tint (dissolution trapping)
      if (result && pTime > 2) {
        const soluFrac = Math.min(1, result.solubilityTrapping / (result.storageCapacity + 0.001))
        if (soluFrac > 0.01) {
          for (const w of wells) {
            const wx = mapX(w.x) * sx
            const wy = (pcapb + (presb - pcapb) * 0.5) * sy
            const brG = ctx.createRadialGradient(wx, wy, 0, wx, wy, CW * 0.35 * soluFrac)
            brG.addColorStop(0,   `rgba(0,80,140,${0.06 * soluFrac})`)
            brG.addColorStop(0.5, `rgba(0,100,160,${0.04 * soluFrac})`)
            brG.addColorStop(1,   'rgba(0,80,140,0)')
            ctx.fillStyle = brG; ctx.fillRect(0, pcapb * sy, CW, (presb - pcapb) * sy)
          }
        }
      }

      // Basement
      const baseG = ctx.createLinearGradient(0, presb * sy, 0, CH)
      baseG.addColorStop(0, '#040607'); baseG.addColorStop(1, '#020304')
      ctx.fillStyle = baseG; ctx.fillRect(0, presb * sy, CW, CH - presb * sy)

      // Layer separators
      ctx.lineWidth = 0.7
      for (const [y, col] of [[pcapt, 'rgba(20,50,70,0.5)'], [pcapb, 'rgba(80,50,20,0.4)'], [presb, 'rgba(20,30,20,0.45)']] as [number, string][]) {
        ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(CW, y * sy); ctx.stroke()
      }

      // ── DEPTH SCALE (y-axis) — tied to actual formation params ─────────
      const depthBounds = [
        { y: PSURF_Y, label: '0 m',                            col: 'rgba(70,100,130,0.5)'  },
        { y: pcapt,   label: `${Math.round(caprockTopM)} m`,   col: 'rgba(80,60,130,0.55)'  },
        { y: pcapb,   label: `${Math.round(reservoirTopM)} m`, col: 'rgba(120,90,35,0.65)'  },
        { y: presb,   label: `${Math.round(reservoirBotM)} m`, col: 'rgba(40,60,40,0.55)'   },
      ]
      ctx.font = `${(fullScreen ? 7 : 6) * sx}px monospace`
      for (const b of depthBounds) {
        ctx.fillStyle = b.col; ctx.textAlign = 'left'
        ctx.fillText(b.label, 2 * sx, b.y * sy + 5 * sy)
        if (b.y > PSURF_Y) {
          ctx.setLineDash([2, 3]); ctx.strokeStyle = b.col; ctx.lineWidth = 0.4
          ctx.beginPath(); ctx.moveTo(32 * sx, b.y * sy); ctx.lineTo(CW, b.y * sy); ctx.stroke()
          ctx.setLineDash([])
        }
      }

      // ── AoR ELLIPSES ────────────────────────────────────────────────────
      const avgRate = wells.length > 0 ? wells.reduce((s, w) => s + w.injectionRate, 0) / wells.length : 1
      if (result && pTime > 0.4) {
        for (const w of wells) {
          const wx    = mapX(w.x) * sx
          const wy    = pcapb * sy
          const baseR = (result.plumeRadius / 2000) * CW * 0.35 * Math.sqrt(Math.min(1, w.injectionRate / avgRate))
          const frac  = Math.min(1, Math.sqrt(Math.max(0, pTime - 0.3) / 49.7))
          const r50 = baseR * frac, r10 = r50 * 0.64, r90 = r50 * 1.36

          if (r90 > 2) {
            ctx.save(); ctx.beginPath()
            ctx.ellipse(wx, wy, r90, r90 * 0.32, 0, Math.PI, 2 * Math.PI)
            ctx.fillStyle = 'rgba(240,144,32,0.04)'; ctx.fill()
            ctx.strokeStyle = 'rgba(240,144,32,0.6)'; ctx.lineWidth = 1.1 * Math.min(sx, sy)
            ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
          }
          if (r50 > 2) {
            ctx.save(); ctx.beginPath()
            ctx.ellipse(wx, wy, r50, r50 * 0.32, 0, Math.PI, 2 * Math.PI)
            ctx.fillStyle = 'rgba(0,196,160,0.05)'; ctx.fill()
            ctx.strokeStyle = 'rgba(0,196,160,0.85)'; ctx.lineWidth = 1.7 * Math.min(sx, sy)
            ctx.stroke(); ctx.restore()
          }
          if (r10 > 2) {
            ctx.save(); ctx.beginPath()
            ctx.ellipse(wx, wy, r10, r10 * 0.32, 0, Math.PI, 2 * Math.PI)
            ctx.strokeStyle = 'rgba(48,144,216,0.55)'; ctx.lineWidth = 1.1 * Math.min(sx, sy)
            ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
          }
        }
      }

      // ── PARTICLES ──────────────────────────────────────────────────────
      for (const st of ['dissolved', 'residual', 'free', 'cap'] as const) {
        for (const p of partsRef.current) { if (p.s === st) p.draw(ctx, sx, sy) }
      }

      // ── WELLS ──────────────────────────────────────────────────────────
      for (const w of wells) {
        const wx = mapX(w.x) * sx

        // Outer casing — metallic gradient
        const cG = ctx.createLinearGradient(wx - 4 * sx, 0, wx + 4 * sx, 0)
        cG.addColorStop(0, '#1a2530'); cG.addColorStop(0.35, '#3d5060')
        cG.addColorStop(0.65, '#506070'); cG.addColorStop(1, '#1a2530')
        ctx.fillStyle = cG; ctx.fillRect(wx - 4 * sx, 0, 8 * sx, presb * sy)

        // Inner bore
        const iG = ctx.createLinearGradient(wx - 2.5 * sx, 0, wx + 2.5 * sx, 0)
        iG.addColorStop(0, '#2a3a48'); iG.addColorStop(0.5, '#607080'); iG.addColorStop(1, '#2a3a48')
        ctx.fillStyle = iG; ctx.fillRect(wx - 2.5 * sx, 0, 5 * sx, (presb - 7) * sy)

        // Perforation glow — radial gradient, no shadowBlur
        if (w.injectionRate > 0) {
          const perfY = (presb - 10) * sy
          const pG = ctx.createRadialGradient(wx, perfY, 0, wx, perfY, 14 * sx)
          pG.addColorStop(0, 'rgba(0,230,180,0.28)')
          pG.addColorStop(0.4, 'rgba(0,196,160,0.12)')
          pG.addColorStop(1, 'rgba(0,196,160,0)')
          ctx.fillStyle = pG; ctx.beginPath(); ctx.arc(wx, perfY, 14 * sx, 0, Math.PI * 2); ctx.fill()
        }

        // Label above caprock
        ctx.fillStyle = 'rgba(140,180,220,0.8)'
        ctx.font = `bold ${(fullScreen ? 8 : 7.5) * sx}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(w.label, wx, (pcapb - 7) * sy)
        if (result && w.injectionRate > 0) {
          ctx.fillStyle = 'rgba(0,196,160,0.7)'
          ctx.font = `${(fullScreen ? 6.5 : 6) * sx}px monospace`
          ctx.fillText(`${w.injectionRate.toFixed(3)} Mt/yr`, wx, (pcapb - 1) * sy)
        }
      }

      // ── LAYER LABELS ────────────────────────────────────────────────────
      ctx.textAlign = 'right'; ctx.font = `${8.5 * sx}px monospace`
      ctx.fillStyle = 'rgba(40,65,85,0.9)'
      ctx.fillText('OVERBURDEN', (PW - 7) * sx, (pcapt - 10) * sy)
      ctx.fillStyle = 'rgba(80,55,30,0.9)'
      ctx.fillText('CAPROCK', (PW - 7) * sx, (pcapt + 12) * sy)
      ctx.fillStyle = 'rgba(115,88,35,0.9)'
      ctx.fillText((params.saltType || 'NaCl') + ' brine', (PW - 7) * sx, (pcapb + 13) * sy)
      ctx.fillStyle = 'rgba(25,35,25,0.9)'
      ctx.fillText('BASEMENT', (PW - 7) * sx, (presb + 10) * sy)

      // ── FORMATION THICKNESS DIMENSION (right side bracket) ───────────────
      const dimX = (PW - 4) * sx
      ctx.strokeStyle = 'rgba(70,110,150,0.55)'; ctx.lineWidth = 0.7 * Math.min(sx, sy); ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(dimX, pcapb * sy); ctx.lineTo(dimX, presb * sy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(dimX - 4 * sx, pcapb * sy); ctx.lineTo(dimX, pcapb * sy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(dimX - 4 * sx, presb * sy); ctx.lineTo(dimX, presb * sy); ctx.stroke()
      ctx.save()
      ctx.translate(dimX + 6 * sx, (pcapb + (presb - pcapb) / 2) * sy)
      ctx.rotate(Math.PI / 2); ctx.textAlign = 'center'
      ctx.font = `${(fullScreen ? 7 : 6) * sx}px monospace`
      ctx.fillStyle = 'rgba(70,110,150,0.7)'
      ctx.fillText(`${params.thickness} m thick`, 0, 0); ctx.restore()

      // ── HORIZONTAL WIDTH DIMENSION (bottom) ──────────────────────────────
      const wKm = Math.sqrt(params.area).toFixed(1)
      const dimYb = (DRAW_BOT - 2) * sy
      ctx.strokeStyle = 'rgba(70,110,150,0.4)'; ctx.lineWidth = 0.6 * Math.min(sx, sy)
      ctx.beginPath(); ctx.moveTo(X_CANVAS_MIN * sx, dimYb); ctx.lineTo(X_CANVAS_MAX * sx, dimYb); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(X_CANVAS_MIN * sx, dimYb - 3 * sy); ctx.lineTo(X_CANVAS_MIN * sx, dimYb); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(X_CANVAS_MAX * sx, dimYb - 3 * sy); ctx.lineTo(X_CANVAS_MAX * sx, dimYb); ctx.stroke()
      ctx.textAlign = 'center'; ctx.font = `${(fullScreen ? 6.5 : 5.5) * sx}px monospace`
      ctx.fillStyle = 'rgba(70,110,150,0.65)'
      ctx.fillText(`${wKm} km wide`, ((X_CANVAS_MIN + X_CANVAS_MAX) / 2) * sx, (DRAW_BOT + 5) * sy)

      // ── PLUME HEIGHT ANNOTATION ───────────────────────────────────────────
      if (result && pTime > 2 && wells.length > 0) {
        const perfMidY = presb - (presb - pcapb) * 0.125  // 87.5% up from reservoir bottom
        const plumeCanvasH = perfMidY - pcapb
        const plumeHeightM = Math.round(params.thickness * 0.875)
        if (plumeCanvasH > 6) {
          const annX = mapX(wells[0].x) * sx + 16 * sx
          ctx.strokeStyle = 'rgba(0,196,160,0.65)'; ctx.lineWidth = 0.9 * Math.min(sx, sy); ctx.setLineDash([3, 2])
          ctx.beginPath(); ctx.moveTo(annX, pcapb * sy); ctx.lineTo(annX, perfMidY * sy); ctx.stroke()
          ctx.setLineDash([])
          ctx.beginPath(); ctx.moveTo(annX - 3 * sx, pcapb * sy); ctx.lineTo(annX, pcapb * sy); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(annX - 3 * sx, perfMidY * sy); ctx.lineTo(annX, perfMidY * sy); ctx.stroke()
          ctx.save()
          ctx.translate(annX + 5 * sx, (pcapb + plumeCanvasH / 2) * sy)
          ctx.rotate(Math.PI / 2); ctx.textAlign = 'center'
          ctx.font = `bold ${(fullScreen ? 7 : 6) * sx}px monospace`
          ctx.fillStyle = 'rgba(0,196,160,0.80)'
          ctx.fillText(`${plumeHeightM}m plume ht`, 0, 0); ctx.restore()
        }
      }

      // ── YEAR LEGEND ──────────────────────────────────────────────────────
      ctx.textAlign = 'right'; ctx.font = `bold ${10 * sx}px monospace`
      ctx.fillStyle = `rgba(0,196,160,${isAnimating ? 0.75 : 0.45})`
      ctx.fillText('Yr ' + pTime.toFixed(1) + (isAnimating ? ' ▶' : ''), (PW - 9) * sx, 13 * sy)

      // ── METRICS PANEL (bottom-left) ──────────────────────────────────────
      if (result) {
        const total = result.residualTrapping + result.solubilityTrapping + Math.max(result.mobilePlume, 0.01)
        const trappedPct = total > 0.001 ? ((result.residualTrapping + result.solubilityTrapping) / total * 100) : 0
        const utilPct = result.totalCapacity > 0 ? (result.storageCapacity / result.totalCapacity * 100) : 0
        const totalRate = wells.reduce((s, w) => s + w.injectionRate, 0)

        const panelX = 4 * sx
        const panelY = (presb + 12) * sy
        const panelW = 150 * sx
        const rowH = 10 * sy

        ctx.fillStyle = 'rgba(6,12,20,0.7)'
        ctx.fillRect(panelX, panelY, panelW, 4.5 * rowH + 6 * sx)

        const metrics = [
          { label: 'Injected',  value: `${result.storageCapacity.toFixed(3)} Mt`, col: '#00c4a0' },
          { label: 'Rate',      value: `${totalRate.toFixed(3)} Mt/yr`,           col: '#60b8f0' },
          { label: 'Util',      value: `${utilPct.toFixed(1)}%`,                  col: utilPct > 100 ? '#f87171' : '#a0d060' },
          { label: 'Trapped',   value: `${trappedPct.toFixed(0)}%`,               col: '#f0a030' },
        ]
        ctx.textAlign = 'left'
        let my = panelY + 6 * sx
        for (const m of metrics) {
          ctx.font = `bold ${(fullScreen ? 7 : 6.5) * sx}px monospace`
          ctx.fillStyle = 'rgba(100,140,170,0.7)'
          ctx.fillText(m.label, panelX + 6 * sx, my)
          ctx.font = `bold ${(fullScreen ? 7.5 : 7) * sx}px monospace`
          ctx.fillStyle = m.col
          ctx.textAlign = 'right'
          ctx.fillText(m.value, panelX + panelW - 6 * sx, my)
          ctx.textAlign = 'left'
          my += rowH
        }

        // Trapping bar
        const barY2 = my + 2 * sx
        const barH2 = 4 * sy
        const barW2 = panelW - 12 * sx
        const tPcts = [
          { pct: result.residualTrapping / total * 100, color: '#f0a030' },
          { pct: result.solubilityTrapping / total * 100, color: '#3090d8' },
          { pct: result.mobilePlume / total * 100, color: '#00c4a0' },
        ]
        let bx = panelX + 6 * sx
        for (const t of tPcts) {
          const bw = Math.max(1, barW2 * t.pct / 100)
          ctx.fillStyle = t.color
          ctx.globalAlpha = 0.75
          ctx.fillRect(bx, barY2, bw, barH2)
          ctx.globalAlpha = 1
          bx += bw
        }
      }
    } // end draw loop

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [fullScreen])

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div
        ref={logRef}
        className="absolute top-2 right-2 pointer-events-none font-mono overflow-hidden"
        style={{
          width:     fullScreen ? '160px' : '100px',
          maxHeight: fullScreen ? '35%'   : '80px',
          fontSize:  fullScreen ? '7px'   : '5.5px',
          lineHeight: '1.25',
        }}
      />
    </div>
  )
}
