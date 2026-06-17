import { describe, it, expect } from 'vitest'
import {
  computeSweepEfficiency,
  computeStorageEfficiency,
  computeAoRHeterogeneityFactor,
  computeHeterogeneityCorrections,
} from '../../../engine/classical/heterogeneityCorrection'
import type { HeterogeneityCorrectionResult } from '../../../engine/classical/heterogeneityCorrection'

// ── Sweep efficiency tests ────────────────────────────────────────────────
describe('computeSweepEfficiency', () => {
  it('returns 1.0 for homogeneous formation (k_Vdp = 0)', () => {
    expect(computeSweepEfficiency(0, 2, 1.0, 0.2)).toBeCloseTo(1.0, 8)
  })

  it('returns < 1.0 for heterogeneous formation (k_Vdp = 0.5)', () => {
    const es = computeSweepEfficiency(0.5, 2, 1.0, 0.2)
    expect(es).toBeLessThan(1.0)
    expect(es).toBeGreaterThan(0.1)
  })

  it('returns significantly reduced sweep for high heterogeneity (k_Vdp = 0.85)', () => {
    const es = computeSweepEfficiency(0.85, 4, 1.0, 0.2)
    expect(es).toBeLessThan(1.0)
    expect(es).toBeGreaterThan(0.0)
  })

  it('monotonically decreases with increasing k_Vdp', () => {
    const vals = [0.1, 0.2, 0.4, 0.6, 0.8].map(v => computeSweepEfficiency(v, 2, 1.0, 0.2))
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeLessThan(vals[i - 1])
    }
  })

  it('increases with increasing PVI', () => {
    const lowPvi = computeSweepEfficiency(0.5, 2, 0.1, 0.2)
    const highPvi = computeSweepEfficiency(0.5, 2, 2.0, 0.2)
    expect(highPvi).toBeGreaterThan(lowPvi)
  })

  it('clamps k_Vdp to [0, 0.85]', () => {
    const neg = computeSweepEfficiency(-0.1, 2, 1.0, 0.2)
    expect(neg).toBeCloseTo(1.0, 8)
    const over = computeSweepEfficiency(1.0, 2, 1.0, 0.2)
    expect(over).toBeGreaterThanOrEqual(0.0)
  })

  it('uses Shook & Mitchell (2009) exponential formula: E_s = 1 - exp(-3*PVI*FQI)', () => {
    const V = 0.5
    const pvi = 1.0
    const phi = 0.2
    const k_ref = 1 - V
    const FQI = Math.sqrt(1 / k_ref) * (1 - V) / phi
    const expected = 1 - Math.exp(-3 * pvi * FQI)
    expect(computeSweepEfficiency(V, 2, pvi, phi)).toBeCloseTo(expected, 6)
  })

  it('returns 0 for PVI = 0', () => {
    const es = computeSweepEfficiency(0.5, 2, 0.0, 0.2)
    expect(es).toBeCloseTo(0.0, 6)
  })
})

// ── Storage efficiency tests ──────────────────────────────────────────────
describe('computeStorageEfficiency', () => {
  it('returns expected value for homogeneous formation with full net-to-gross, single layer', () => {
    const ec = computeStorageEfficiency(0, 1, 1, 2, 1.0, 0.2, 1.0)
    expect(ec).toBeCloseTo(1.0 / Math.sqrt(2), 4)
  })

  it('reduces storage efficiency when net-to-gross < 1', () => {
    const full = computeStorageEfficiency(0.3, 1, 1, 2, 1.0, 0.2, 1.0)
    const partial = computeStorageEfficiency(0.3, 1, 1, 2, 1.0, 0.2, 0.5)
    expect(partial).toBeLessThan(full)
  })

  it('returns lower storage efficiency for heterogeneous formation', () => {
    const hom = computeStorageEfficiency(0, 1, 1, 2, 1.0, 0.2, 1.0)
    const het = computeStorageEfficiency(0.6, 1, 1, 2, 1.0, 0.2, 1.0)
    expect(het).toBeLessThan(hom)
  })

  it('clamps netToGross to [0.01, 1]', () => {
    const zeroNtg = computeStorageEfficiency(0, 1, 1, 2, 1.0, 0.2, 0)
    expect(zeroNtg).toBeGreaterThanOrEqual(0.01)
    const overNtg = computeStorageEfficiency(0, 1, 1, 2, 1.0, 0.2, 2)
    expect(overNtg).toBeLessThanOrEqual(1)
  })

  it('reduces storage efficiency when k_layer_ratio > 1 (anisotropy degrades vertical sweep)', () => {
    const iso = computeStorageEfficiency(0, 1, 3, 2, 1.0, 0.2, 1.0)
    const aniso = computeStorageEfficiency(0, 10, 3, 2, 1.0, 0.2, 1.0)
    expect(aniso).toBeLessThan(iso)
  })

  it('ignores k_layer_ratio when n_layers <= 1 (backward compatible)', () => {
    const singleLayer = computeStorageEfficiency(0, 100, 1, 2, 1.0, 0.2, 1.0)
    const multiLayer = computeStorageEfficiency(0, 100, 2, 2, 1.0, 0.2, 1.0)
    expect(singleLayer).toBeGreaterThan(multiLayer)
  })
})

// ── AoR heterogeneity factor tests ────────────────────────────────────────
describe('computeAoRHeterogeneityFactor', () => {
  it('returns 1.0 for single layer (no heterogeneity)', () => {
    expect(computeAoRHeterogeneityFactor(0.5, 1)).toBeCloseTo(1.0, 8)
    expect(computeAoRHeterogeneityFactor(0, 1)).toBeCloseTo(1.0, 8)
  })

  it('returns 1.0 for homogeneous formation (k_Vdp = 0) regardless of layers', () => {
    expect(computeAoRHeterogeneityFactor(0, 5)).toBeCloseTo(1.0, 8)
    expect(computeAoRHeterogeneityFactor(0, 10)).toBeCloseTo(1.0, 8)
  })

  it('returns > 1.0 for heterogeneous formation with multiple layers', () => {
    const f = computeAoRHeterogeneityFactor(0.5, 5)
    expect(f).toBeGreaterThan(1.0)
    expect(f).toBeLessThan(3.0)
  })

  it('increases with k_Vdp for fixed n_layers', () => {
    const vals = [0.2, 0.4, 0.6, 0.8].map(v => computeAoRHeterogeneityFactor(v, 5))
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1])
    }
  })

  it('returns physically plausible values at SPE11b conditions (k_Vdp = 0.72)', () => {
    const f = computeAoRHeterogeneityFactor(0.72, 7)
    // For V=0.72: σ = -ln(0.28) = 1.273, σ²/2 = 0.810, sqrt(k_ratio) = exp(0.405) ≈ 1.5
    expect(f).toBeGreaterThan(1.3)
    expect(f).toBeLessThan(2.5)
  })
})

// ── Integration: computeHeterogeneityCorrections ──────────────────────────
describe('computeHeterogeneityCorrections', () => {
  it('returns all fields for homogeneous formation', () => {
    const r = computeHeterogeneityCorrections(0, 2, 1.0, 1)
    expect(r.sweepEfficiency).toBeCloseTo(1.0, 8)
    expect(r.aorHeterogeneityFactor).toBeCloseTo(1.0, 8)
    expect(r.kArithmeticGeometricRatio).toBeCloseTo(1.0, 8)
    expect(r.storageEfficiency).toBeGreaterThan(0)
  })

  it('returns all fields for heterogeneous SPE11b-like formation', () => {
    const r = computeHeterogeneityCorrections(0.72, 3.5, 0.85, 7, 5, 1.0, 0.2)
    expect(r.sweepEfficiency).toBeLessThan(1.0)
    expect(r.sweepEfficiency).toBeGreaterThan(0.0)
    expect(r.storageEfficiency).toBeLessThan(1.0)
    expect(r.aorHeterogeneityFactor).toBeGreaterThan(1.0)
    expect(r.kArithmeticGeometricRatio).toBeGreaterThan(1.0)
  })

  it('returns consistent types for all fields', () => {
    const r = computeHeterogeneityCorrections(0.5, 3, 0.8, 5, 1, 1.0, 0.2)
    expect(typeof r.sweepEfficiency).toBe('number')
    expect(typeof r.storageEfficiency).toBe('number')
    expect(typeof r.aorHeterogeneityFactor).toBe('number')
    expect(typeof r.kArithmeticGeometricRatio).toBe('number')
  })

  it('sweep efficiency is higher than storage efficiency (storage includes displacement + geometry)', () => {
    const r = computeHeterogeneityCorrections(0.5, 3, 0.8, 5, 1, 1.0, 0.2)
    expect(r.sweepEfficiency).toBeGreaterThan(r.storageEfficiency)
  })

  it('result type matches interface', () => {
    const r: HeterogeneityCorrectionResult = computeHeterogeneityCorrections(0.3, 2, 1.0, 3)
    expect(r.sweepEfficiency).toBeDefined()
    expect(r.storageEfficiency).toBeDefined()
    expect(r.aorHeterogeneityFactor).toBeDefined()
    expect(r.kArithmeticGeometricRatio).toBeDefined()
  })

  it('accepts optional new parameters with backward-compatible defaults', () => {
    const r1 = computeHeterogeneityCorrections(0.5, 2, 0.8, 3)
    const r2 = computeHeterogeneityCorrections(0.5, 2, 0.8, 3, 1, 1.0, 0.2)
    expect(r1.sweepEfficiency).toBeCloseTo(r2.sweepEfficiency, 6)
    expect(r1.storageEfficiency).toBeCloseTo(r2.storageEfficiency, 6)
  })
})
