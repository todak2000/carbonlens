import { describe, it, expect } from 'vitest'
import {
  clamp,
  degToK,
  kToDeg,
  mpaToPsi,
  psiToMpa,
  mToFt,
  ftToM,
  km2ToM2,
  kgToTonne,
  tonnesToGt,
  linearInterp,
} from '../../utils/math'

describe('clamp', () => {
  it('returns value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('clamps to minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })
  it('clamps to maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })
  it('handles boundary values', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('temperature conversions', () => {
  it('degToK: 0°C → 273.15 K', () => {
    expect(degToK(0)).toBeCloseTo(273.15, 5)
  })
  it('degToK: 100°C → 373.15 K', () => {
    expect(degToK(100)).toBeCloseTo(373.15, 5)
  })
  it('kToDeg: 273.15 K → 0°C', () => {
    expect(kToDeg(273.15)).toBeCloseTo(0, 5)
  })
  it('round-trip: degToK then kToDeg returns original', () => {
    const original = 37
    expect(kToDeg(degToK(original))).toBeCloseTo(original, 10)
  })
})

describe('pressure conversions', () => {
  it('mpaToPsi: 1 MPa ≈ 145.038 psi', () => {
    expect(mpaToPsi(1)).toBeCloseTo(145.038, 2)
  })
  it('psiToMpa: 145.038 psi ≈ 1 MPa', () => {
    expect(psiToMpa(145.038)).toBeCloseTo(1, 3)
  })
  it('round-trip: mpaToPsi then psiToMpa returns original', () => {
    const original = 10.3
    expect(psiToMpa(mpaToPsi(original))).toBeCloseTo(original, 8)
  })
})

describe('length conversions', () => {
  it('mToFt: 1 m ≈ 3.28084 ft', () => {
    expect(mToFt(1)).toBeCloseTo(3.28084, 4)
  })
  it('ftToM: 1 ft ≈ 0.3048 m', () => {
    expect(ftToM(1)).toBeCloseTo(0.3048, 4)
  })
  it('round-trip conversion', () => {
    expect(ftToM(mToFt(100))).toBeCloseTo(100, 8)
  })
})

describe('area conversion', () => {
  it('km2ToM2: 1 km² = 1,000,000 m²', () => {
    expect(km2ToM2(1)).toBe(1e6)
  })
  it('km2ToM2: 27 km² = 27,000,000 m²', () => {
    expect(km2ToM2(27)).toBe(27e6)
  })
})

describe('mass conversions', () => {
  it('kgToTonne: 1000 kg = 1 tonne', () => {
    expect(kgToTonne(1000)).toBe(1)
  })
  it('tonnesToGt: 1e9 tonnes = 1 Gt', () => {
    expect(tonnesToGt(1e9)).toBe(1)
  })
})

describe('linearInterp', () => {
  it('returns y0 when x = x0', () => {
    expect(linearInterp(0, 0, 10, 1, 20)).toBeCloseTo(10, 10)
  })
  it('returns y1 when x = x1', () => {
    expect(linearInterp(1, 0, 10, 1, 20)).toBeCloseTo(20, 10)
  })
  it('interpolates midpoint correctly', () => {
    expect(linearInterp(0.5, 0, 0, 1, 10)).toBeCloseTo(5, 5)
  })
  it('extrapolates linearly beyond range', () => {
    expect(linearInterp(2, 0, 0, 1, 10)).toBeCloseTo(20, 5)
  })
})
