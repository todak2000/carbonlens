import { describe, it, expect } from 'vitest'
import {
  reservoirTemperature,
  jouleThomstonCooling,
  radialTemperatureProfile,
  effectiveTemperature,
  isCO2Supercritical,
  co2PhaseState,
  DEFAULT_THERMAL,
} from '../../../engine/plume/thermalEffects'

describe('thermalEffects', () => {
  it('reservoir temperature increases with depth', () => {
    const T1 = reservoirTemperature(1000, DEFAULT_THERMAL)
    const T2 = reservoirTemperature(2000, DEFAULT_THERMAL)
    expect(T2).toBeGreaterThan(T1)
  })

  it('geothermal gradient 30°C/km gives correct T at 1km', () => {
    const params = { ...DEFAULT_THERMAL, surfaceTemperature_C: 15, geothermalGradient_CPerKm: 30 }
    expect(reservoirTemperature(1000, params)).toBeCloseTo(45, 0)
  })

  it('JT cooling is negative (temperature decrease)', () => {
    const dT = jouleThomstonCooling(25, 15, 50)
    expect(dT).toBeLessThan(0)
  })

  it('JT cooling is zero when no pressure drop', () => {
    const dT = jouleThomstonCooling(15, 15, 50)
    expect(dT).toBe(0)
  })

  it('radial temperature profile decays with distance', () => {
    const dT_near = radialTemperatureProfile(1, 1, -10, 1e-6)
    const dT_far = radialTemperatureProfile(100, 1, -10, 1e-6)
    expect(Math.abs(dT_near)).toBeGreaterThan(Math.abs(dT_far))
  })

  it('isCO2Supercritical correct for reservoir conditions', () => {
    expect(isCO2Supercritical(50, 20)).toBe(true)   // typical reservoir
    expect(isCO2Supercritical(20, 5)).toBe(false)   // below Tc and Pc
    expect(isCO2Supercritical(50, 5)).toBe(false)   // above Tc, below Pc
  })

  it('co2PhaseState identifies states correctly', () => {
    expect(co2PhaseState(50, 20)).toBe('supercritical')
    expect(co2PhaseState(20, 5)).toBe('gas')
    expect(co2PhaseState(20, 15)).toBe('liquid')
  })

  it('effectiveTemperature near wellbore is cooler than reservoir T', () => {
    // At r=1m (near wellbore), JT cooling should reduce T below geothermal
    const T_eff = effectiveTemperature(1, 1, 1000, 25, 15, DEFAULT_THERMAL)
    const T_res = reservoirTemperature(1000, DEFAULT_THERMAL)
    expect(T_eff).toBeLessThan(T_res)
  })
})
