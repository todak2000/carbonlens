/**
 * Sleipner Utsira Formation — field data for benchmark validation
 * ===============================================================
 *
 * Primary references:
 *   Arts et al. 2004 — Energy 29, 1383-1392
 *   Boait et al. 2012 — JGR 117, B03309 (doi:10.1029/2011JB008603)
 *     [Figures 7, 13 digitized data courtesy of user]
 *   Furre et al. 2017 — Energy Procedia 114, 3916-3926
 *     [20 years of monitoring; dissolution constraint from gravimetry]
 *   Chadwick et al. 2009 — Energy Procedia 1, 2103-2110
 *   Zweigel et al. 2004 — Geol. Soc. Spec. Publ. 233, 165-180
 *
 * Nine reflective horizons (1 = deepest at injection point, 9 = shallowest
 * just below caprock) are imaged on 10 post-injection 3D seismic surveys
 * (1999, 2001, 2002, 2004, 2006, 2008, 2010, 2013, 2016). Plus 4 gravity
 * surveys (2002, 2005, 2009, 2013). Injection started Sep 1996.
 *
 * All spatial coordinates are in normalised model space [-1, 1] × [-1, 1]
 * unless otherwise noted. Model space: 10 km × 10 km → 1 unit = 5 km.
 */

// ── Reservoir Properties ─────────────────────────────────────────────────────
export const SLEIPNER = {
  depthM: 1012,
  thicknessM: 200,
  caprockThicknessM: 200,
  mudstoneThicknessM: 1.5,
  thickestMudstoneM: 5,

  porosityRange: [0.27, 0.37] as [number, number],
  permeabilityRange: [1000, 3000] as [number, number],
  effectivePermeability: 200,
  caprockPermeability: 4e-7,
  mudstonePermeability: 1.15e-4,

  pressureMPa: 10.3,
  wellheadPressureMPa: 6.3,
  temperatureC: 36,
  temperatureInjectionC: 41,
  temperatureTopC: 27.7,

  /** In-situ CO₂ density from gravimetric + seismic inversion: 720±55 kg/m³ (Furre 2017 §4) */
  co2Density: 720,
  co2DensityInjection: 485,
  co2DensityPeak: 710,
  co2Viscosity: 5.5e-5,
  brineDensity: 1020,
  brineViscosity: 7e-4,
  deltaRho: 319,

  buoyancyVelocity: 4.3e-6,
  inputFlux: 0.04,
  mobilityRatio: 13,

  /** Injection rate was ~0.9 Mt/yr initially, dropped slightly later years */
  injectionRateMtPerYear: 0.9,
  /** Total injected by end 2008 (Mt) */
  totalBy2008: 10.0,
  /** Total injected by end 2016 (Mt) — Furre 2017: "more than 16 Mt" */
  totalBy2016: 16.0,

  domeDiameterKm: 1.2,
  domeHeightAboveSpillM: 12,
  domeMaxSlopeDeg: 1.2,

  simulationAreaKm2: 15.7,
} as const

// ── Multi-Layer Horizon Data ─────────────────────────────────────────────────
export interface SleipnerHorizonData {
  layer: number
  depthBelowCaprockM: number
  initiationYear: number
  ellipticity: number
  t0Years: number
  slopeKm2PerYr: number
  rSquared: number
  fluxM3PerS: number
  notes: string
}

export const SLEIPNER_HORIZONS: SleipnerHorizonData[] = [
  { layer: 1, depthBelowCaprockM: 200, initiationYear: 0,   ellipticity: 2, t0Years: 0.0, slopeKm2PerYr: 0.60, rSquared: 0.98, fluxM3PerS: 0.0006, notes: 'Shrinks after yr 8; leakage through mudstone' },
  { layer: 2, depthBelowCaprockM: 180, initiationYear: 0,   ellipticity: 2, t0Years: 0.0, slopeKm2PerYr: 0.70, rSquared: 0.97, fluxM3PerS: 0.003,  notes: 'Shrinks after yr 8' },
  { layer: 3, depthBelowCaprockM: 160, initiationYear: 1.8, ellipticity: 3, t0Years: 1.0, slopeKm2PerYr: 0.50, rSquared: 0.95, fluxM3PerS: 0.004,  notes: 'Stalls yr 8-12; ellipticity grows 1→3' },
  { layer: 4, depthBelowCaprockM: 140, initiationYear: 0,   ellipticity: 4, t0Years: 0.5, slopeKm2PerYr: 0.30, rSquared: 0.90, fluxM3PerS: 0.001,  notes: 'Shrinks from yr 6; fragmented' },
  { layer: 5, depthBelowCaprockM: 120, initiationYear: 0,   ellipticity: 4, t0Years: 0.5, slopeKm2PerYr: 1.00, rSquared: 0.99, fluxM3PerS: 0.01,   notes: 'Strong gravity current; center dims after yr 8' },
  { layer: 6, depthBelowCaprockM: 100, initiationYear: 3,   ellipticity: 4, t0Years: 2.0, slopeKm2PerYr: 0.35, rSquared: 0.97, fluxM3PerS: 0.0007, notes: 'Fragmented; rapid ellipticity growth 2001-2002' },
  { layer: 7, depthBelowCaprockM: 80,  initiationYear: 1.6, ellipticity: 2, t0Years: 0.5, slopeKm2PerYr: 0.35, rSquared: 0.96, fluxM3PerS: 0.003,  notes: 'Stable growth; constant ellipticity' },
  { layer: 8, depthBelowCaprockM: 30,  initiationYear: 0,   ellipticity: 2, t0Years: 0.0, slopeKm2PerYr: 0.55, rSquared: 0.99, fluxM3PerS: 0.002,  notes: '5m mudstone cap; center dims after yr 10' },
  { layer: 9, depthBelowCaprockM: 5,   initiationYear: 3.2, ellipticity: 4, t0Years: 3.0, slopeKm2PerYr: 0.85, rSquared: 0.99, fluxM3PerS: 0.007,  notes: 'Top seal layer; ellipticity 2→4; center dims yr 12+' },
]

// ── Digitized Area-vs-Time Data ──────────────────────────────────────────────
// From Boait 2012 Figures 7 & 13. Years since injection start (Sep 1996).
// Data courtesy of user digitization.

/** Layer 9 (top seal, just below caprock) area vs time */
export const SLEIPNER_LAYER9_AREA: { year: number; areaKm2: number }[] = [
  { year: 3,  areaKm2: 0.28 },
  { year: 5,  areaKm2: 0.82 },
  { year: 6,  areaKm2: 1.15 },
  { year: 8,  areaKm2: 1.76 },
  { year: 10, areaKm2: 2.45 },
  { year: 12, areaKm2: 3.12 },
  { year: 14, areaKm2: 4.40 },
]

/** Layers 1-8 (combined) area vs time */
export const SLEIPNER_LAYERS1_8_AREA: { year: number; areaKm2: number }[] = [
  { year: 3,  areaKm2: 0.45 },
  { year: 5,  areaKm2: 0.95 },
  { year: 6,  areaKm2: 1.10 },
  { year: 8,  areaKm2: 1.38 },
  { year: 10, areaKm2: 1.62 },
  { year: 12, areaKm2: 1.95 },
  { year: 14, areaKm2: 2.10 },
]

/** Total plume area (all layers) by year — validated against 2000/2004/2008/2012 surveys */
export const SLEIPNER_TOTAL_AREA: { year: number; areaKm2Min: number; areaKm2Max: number }[] = [
  { year: 4,  areaKm2Min: 0.85, areaKm2Max: 1.10 },
  { year: 8,  areaKm2Min: 1.32, areaKm2Max: 1.55 },
  { year: 12, areaKm2Min: 2.23, areaKm2Max: 2.40 },
  { year: 16, areaKm2Min: 2.80, areaKm2Max: 3.25 },
]

// ── Seismic Velocity Pushdown vs Time ────────────────────────────────────────
// Maximum two-way travel time (TWT) delay of Base Utsira (BU) horizon.
// From Boait 2012 Figure 7.
export const SLEIPNER_PUSHDOWN: { year: number; maxPushdownMs: number }[] = [
  { year: 3,  maxPushdownMs: 18.0 },
  { year: 5,  maxPushdownMs: 26.5 },
  { year: 6,  maxPushdownMs: 31.0 },
  { year: 8,  maxPushdownMs: 42.0 },
  { year: 10, maxPushdownMs: 48.5 },
  { year: 12, maxPushdownMs: 53.0 },
  { year: 14, maxPushdownMs: 57.5 },
]

// ── Key Physics Constraints for Validation ────────────────────────────────────
export const SLEIPNER_VALIDATION = {
  /** In-situ CO₂ density from gravimetry (kg/m³) — Furre 2017 §4 */
  co2Density: 720,
  /** CO₂ density uncertainty (± kg/m³) */
  co2DensityUncertainty: 55,

  /**
   * Dissolution rate constraint from gravimetry (Furre 2017 §4):
   * "This gives a dissolution rate between 0 % and 2.7 % per year"
   * After 17 years of injection, detectable free CO₂ mass equals
   * cumulative injected mass within measurement uncertainty.
   * → Our dissolution model should produce ≤ 2.7%/yr for Sleipner conditions.
   */
  dissolutionRateMaxPerYear: 0.027,
  dissolutionRateExpected: 0.015,

  /** No measurable free-phase mass loss — validates containment (Furre 2017 §6) */
  freeMassConservation: true,

  /** Gravity current scaling: r² ∝ t (Boait 2012 eq A1) */
  gravityCurrentSlope: 0.0035,
  radiusYear4: 650,
  radiusYear12: 1150,

  /** Layer 9 area at year 14 (km²) — target for solver comparison */
  layer9AreaYear14Km2: 4.40,
  /** Layers 1-8 combined area at year 14 (km²) */
  layers1to8AreaYear14Km2: 2.10,
  /** Pushdown at year 14 (ms) */
  pushdownYear14Ms: 57.5,

  /** Residual gas saturation (fraction) */
  residualGasSaturation: 0.10,
  /** Tuning thickness for CO₂ layers (m) — Arts 2004 */
  tuningThicknessM: 8,
  /** Average CO₂ layer thickness (m) — Boait 2012 §3.3 */
  avgLayerThicknessM: 8,
  /** Average CO₂ saturation within layers (fraction) — Boait 2012 §3.3 */
  avgSaturation: 0.80,
}

// ── Gravity Current Analytical Solution ──────────────────────────────────────
// Boait 2012 eq A1: r_N(t) = 1.15 × (ub·Q/φ²)^(1/4) × √t
// where ub = Δρ·k·g/μ_n  (eq A2)
export function sleipnerGravityRadius(years: number, k_m2 = 2e-13, phi = 0.35): number {
  const ub = SLEIPNER.deltaRho * k_m2 * 9.81 / SLEIPNER.co2Viscosity
  return 1.15 * Math.pow(ub * SLEIPNER.inputFlux / (phi * phi), 0.25) * Math.sqrt(years * 3.156e7)
}

// ── Elliptical Planform Approximations ───────────────────────────────────────
export interface SleipnerPlumeOutline {
  year: number; cx: number; cy: number; a: number; b: number; theta: number
}

export const SLEIPNER_TOP_SEAL: SleipnerPlumeOutline[] = [
  { year: 4,  cx: 0.00, cy: 0.15, a: 0.22, b: 0.14, theta: 0.12 },
  { year: 8,  cx: 0.02, cy: 0.18, a: 0.35, b: 0.20, theta: 0.10 },
  { year: 12, cx: 0.03, cy: 0.20, a: 0.45, b: 0.25, theta: 0.08 },
  { year: 16, cx: 0.05, cy: 0.22, a: 0.52, b: 0.28, theta: 0.06 },
]

export const SLEIPNER_INJECTION: SleipnerPlumeOutline[] = [
  { year: 4,  cx: 0.00, cy: 0.10, a: 0.25, b: 0.14, theta: 0.10 },
  { year: 8,  cx: 0.02, cy: 0.12, a: 0.30, b: 0.20, theta: 0.08 },
  { year: 12, cx: 0.03, cy: 0.12, a: 0.38, b: 0.22, theta: 0.06 },
  { year: 16, cx: 0.05, cy: 0.12, a: 0.40, b: 0.24, theta: 0.05 },
]

// ── Multi-layer elliptical outlines (layer 5 and layer 1) ─────────────────────

export const SLEIPNER_LAYER_5: SleipnerPlumeOutline[] = [
  { year: 4,  cx: 0.01, cy: 0.05, a: 0.20, b: 0.08, theta: 0.08 },
  { year: 8,  cx: 0.02, cy: 0.08, a: 0.32, b: 0.14, theta: 0.06 },
  { year: 12, cx: 0.03, cy: 0.10, a: 0.40, b: 0.18, theta: 0.05 },
]

export const SLEIPNER_LAYER_1: SleipnerPlumeOutline[] = [
  { year: 4,  cx: 0.00, cy: 0.00, a: 0.18, b: 0.10, theta: 0.10 },
  { year: 8,  cx: 0.01, cy: 0.02, a: 0.24, b: 0.14, theta: 0.08 },
]
