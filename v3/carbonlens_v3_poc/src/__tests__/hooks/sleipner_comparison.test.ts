/**
 * sleipner_comparison.test.ts
 *
 * Runs the CarbonLens simulation engine with Sleipner parameters that exactly
 * match the MRST 2026a co2lab-ve benchmark, then prints comparable metrics.
 *
 * MRST benchmark results (from result.md):
 *   Year  5 plume area : 0.25 km²
 *   Year 10 plume area : 1.25 km²
 *   Year 20 plume area : 6.25 km²
 *   BHP  at Year 10   : 20.64 MPa
 *
 * Formation (matching MRST deck):
 *   Domain       : 30 km × 30 km × 200 m
 *   Grid (MRST)  : 60 × 60 × 20 Cartesian VE cells (500 m/cell)
 *   Grid (CL VE) : 40 × 40 VE cells               (750 m/cell)
 *   Depth to top : 800 m
 *   Porosity     : 0.36
 *   Perm (H)     : 2000 mD
 *   Pressure     : 10.3 MPa
 *   Temperature  : 37 °C
 *   CO2 density  : ~631 kg/m³ (MRST prescribed; CarbonLens uses EOS)
 *   Injection    : 1 Mt/yr, centre well, 20 years
 */

import { describe, it, beforeEach } from 'vitest'
import { computeYearly }            from '../../hooks/useSimulation'
import { useFormationStore }        from '../../store/formationStore'
import { useSimulationStore }       from '../../store/simulationStore'
import {
  VESolver, uniformPermField, wellToGridIndex,
} from '../../engine/ve'
import {
  co2DensityWithImpurities,
  brineDensityGarcia,
  co2ViscosityFenghour,
} from '../../engine'
import type { FormationParams, Well } from '../../types'

// ── Sleipner parameters matching the MRST .DATA deck ─────────────────────────

const SLEIPNER_PARAMS: FormationParams = {
  depth:               800,
  thickness:           200,
  porosity:            0.36,
  permeability:        2000,
  pressure:            10.3,
  temperature:         37,
  monovalentSalinity:  0.05,
  bivalentSalinity:    0,
  saltType:            'NaCl',
  methaneFraction:     0,
  nitrogenFraction:    0,
  area:                900,      // 30 km × 30 km = 900 km²
  geometryType:        'dome',
  netToGross:          1.0,      // MRST has no NTG concept — set to 1
  caprockFriction:     26,
  caprockCohesion:     6,
  biotCoefficient:     0.7,
  formationType:       'saline_aquifer',
  poissonRatio:        0.24,
  overburdenGradient:  0.0215,
  stressRatioK0:       0.60,
}

const SLEIPNER_WELLS: Well[] = [{
  id:            'injector-1',
  x:             0,        // centre (fractional coords)
  z:             0,
  injectionRate: 1.0,      // Mt/yr
  label:         'Sleipner Injector',
  rampUpYears:   0,        // no ramp — matches MRST step schedule
  rampDownYears: 0,
}]

// ── VE solver constants (match useSimulation.ts Fix 1: upgraded from 40×40) ──
const VE_NX = 60
const VE_NY = 60

// ── Test suite ────────────────────────────────────────────────────────────────

describe('CarbonLens vs MRST Sleipner Benchmark', () => {

  beforeEach(() => {
    useFormationStore.setState({ wells: SLEIPNER_WELLS })
    useSimulationStore.setState({ result: null })
  })

  it('runs 20-year injection and prints comparable metrics', () => {

    // ── 1. Fluid properties (EOS) ──────────────────────────────────────────
    const T_K   = SLEIPNER_PARAMS.temperature + 273.15   // 310.15 K
    const P_Pa  = SLEIPNER_PARAMS.pressure * 1e6         // 10.3 MPa

    const co2Density   = co2DensityWithImpurities(T_K, P_Pa, 0, 0)
    const brineDensity = brineDensityGarcia(T_K, SLEIPNER_PARAMS.pressure, SLEIPNER_PARAMS.monovalentSalinity, 0)
    const co2Viscosity = co2ViscosityFenghour(T_K, co2Density)

    console.log('\n=== CarbonLens EOS Fluid Properties ===')
    console.log(`CO2 density    : ${co2Density.toFixed(1)} kg/m³   (MRST prescribed: 631 kg/m³)`)
    console.log(`Brine density  : ${brineDensity.toFixed(1)} kg/m³`)
    console.log(`CO2 viscosity  : ${(co2Viscosity * 1000).toFixed(4)} mPa·s`)
    console.log(`Delta rho      : ${(brineDensity - co2Density).toFixed(1)} kg/m³`)

    // ── 2. VE solver — plume area at years 5, 10, 20 ──────────────────────
    const dx_m = Math.sqrt(SLEIPNER_PARAMS.area * 1e6) / VE_NX   // 750 m
    const dy_m = Math.sqrt(SLEIPNER_PARAMS.area * 1e6) / VE_NY   // 750 m

    const veSolver = new VESolver(
      { nx: VE_NX, ny: VE_NY, dx_m, dy_m },
      {
        co2Density,
        brineDensity,
        co2Viscosity,
        porosity:  SLEIPNER_PARAMS.porosity,
        Swi:       0.15,
        thickness: SLEIPNER_PARAMS.thickness,
      },
      uniformPermField(VE_NX, VE_NY, SLEIPNER_PARAMS.permeability),
    )

    const { i: wi, j: wj } = wellToGridIndex(0, 0, VE_NX, VE_NY)
    const q_m3s = (1.0 * 1e9) / (co2Density * 365.25 * 24 * 3600)

    const vePlumeAreas: Record<number, number> = {}

    for (let yr = 1; yr <= 20; yr++) {
      const veState = veSolver.step([{ i: wi, j: wj, q_m3s }])
      if ([5, 10, 20].includes(yr)) {
        vePlumeAreas[yr] = veState.plumeArea_m2 / 1e6
      }
    }

    // ── 3. computeYearly — BHP and analytical pressure at years 5, 10, 20 ─
    let prevResult = null
    const analyticalResults: Record<number, ReturnType<typeof computeYearly>> = {}

    for (let yr = 1; yr <= 20; yr++) {
      const r = computeYearly(SLEIPNER_PARAMS, yr, 20, prevResult)
      prevResult = r
      if ([5, 10, 20].includes(yr)) {
        analyticalResults[yr] = r
      }
    }

    // ── 4. Print comparison table ──────────────────────────────────────────
    console.log('\n=== Plume Area Comparison (km²) ===')
    console.log('Year | CarbonLens VE | MRST 2026a | Delta')
    console.log('-----|---------------|------------|------')
    const mrstAreas: Record<number, number> = { 5: 0.25, 10: 1.25, 20: 6.25 }
    for (const yr of [5, 10, 20]) {
      const cl   = vePlumeAreas[yr]
      const mrst = mrstAreas[yr]
      const delta = ((cl - mrst) / mrst * 100).toFixed(1)
      console.log(` ${String(yr).padStart(2)}  | ${cl.toFixed(3).padStart(13)} | ${mrst.toFixed(3).padStart(10)} | ${delta}%`)
    }

    console.log('\n=== BHP / Injection Pressure Comparison (MPa) ===')
    console.log('Year | CarbonLens | MRST  | Delta')
    console.log('-----|------------|-------|------')
    const mrstBHP: Record<number, number> = { 5: null as any, 10: 20.64, 20: null as any }
    for (const yr of [5, 10, 20]) {
      const clBHP = analyticalResults[yr]?.injectionPressure
      if (mrstBHP[yr] !== null) {
        const delta = clBHP != null ? ((clBHP - mrstBHP[yr]) / mrstBHP[yr] * 100).toFixed(1) : 'N/A'
        console.log(` ${String(yr).padStart(2)}  | ${clBHP?.toFixed(2).padStart(10)} | ${mrstBHP[yr].toFixed(2)} | ${delta}%`)
      } else {
        console.log(` ${String(yr).padStart(2)}  | ${clBHP?.toFixed(2).padStart(10)} | N/A   | N/A`)
      }
    }

    console.log('\n=== Additional CarbonLens Metrics (Year 20) ===')
    const r20 = analyticalResults[20]
    if (r20) {
      console.log(`Storage capacity : ${r20.storageCapacity.toFixed(2)} Mt  (expected ~20 Mt)`)
      console.log(`CO2 density (EOS): ${r20.co2Density.toFixed(1)} kg/m³`)
      console.log(`Plume radius     : ${(r20.plumeRadius / 1000).toFixed(2)} km`)
      console.log(`Residual trapped : ${r20.residualTrapping.toFixed(3)} Mt`)
      console.log(`Dissolved        : ${r20.solubilityTrapping.toFixed(3)} Mt`)
      console.log(`Mobile plume     : ${r20.mobilePlume.toFixed(3)} Mt`)
      console.log(`Total capacity   : ${r20.totalCapacity.toFixed(1)} Mt  (P50 DOE)`)
      console.log(`Capacity util    : ${r20.capacityUtilPct.toFixed(1)}%`)
      console.log(`Overpressure risk: ${r20.overpressureRisk}`)
    }

    console.log('\n=== VE Grid Configuration Difference ===')
    console.log(`MRST   : 60 × 60 cells, 500 m/cell, 3D (20 layers)`)
    console.log(`CarbonLens VE: 60 × 60 cells, 500 m/cell, depth-integrated 2D`)
    console.log(`Both   : 30 km × 30 km domain, sharp-interface VE physics`)
  })
})
