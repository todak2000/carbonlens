/**
 * particleEngine.test.ts
 *
 * Unit tests for the pure logic of ParticleEngine:
 *   - Construction and initial state
 *   - reset() zeroes out all particles
 *   - tick() with isAnimating=false never spawns particles
 *   - tick() with isAnimating=true spawns particles over time
 *   - Particle lifecycle: inject → rise → cap → residual/dissolving
 *   - activeCount stays within pool bounds
 *   - Position/color/size buffers are correctly sized
 *   - No Three.js dependency (engine is pure TS)
 */

import { describe, it, expect } from 'vitest'
import { ParticleEngine, MAX_PARTICLES, STRIDE } from '../../../engine/plume/particleEngine'
import type { ParticleSource, ParticleEngineConfig } from '../../../engine/plume/particleEngine'

const DEFAULT_CFG: ParticleEngineConfig = {
  caprockY:        0.6,
  reservoirBottomY: -0.6,
  sceneHalfW:      1.0,
  dissolvedFraction: 0.2,
  residualFraction:  0.3,
}

const DEFAULT_SOURCE: ParticleSource = {
  x: 0,
  z: 0,
  injectionRateMtPerYear: 1.0,
}

describe('ParticleEngine — construction', () => {
  it('creates typed arrays with correct sizes', () => {
    const pe = new ParticleEngine()
    expect(pe.data.length).toBe(MAX_PARTICLES * STRIDE)
    expect(pe.alive.length).toBe(MAX_PARTICLES)
    expect(pe.positions.length).toBe(MAX_PARTICLES * 3)
    expect(pe.colors.length).toBe(MAX_PARTICLES * 3)
    expect(pe.sizes.length).toBe(MAX_PARTICLES)
  })

  it('starts with zero active particles', () => {
    const pe = new ParticleEngine()
    expect(pe.activeCount).toBe(0)
  })
})

describe('ParticleEngine — reset()', () => {
  it('sets activeCount to 0 after spawning', () => {
    const pe = new ParticleEngine()
    // Spawn some particles
    for (let i = 0; i < 10; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    pe.reset()
    expect(pe.activeCount).toBe(0)
  })

  it('parks all particles at y = -999 (off-screen)', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 5; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    pe.reset()
    for (let i = 0; i < MAX_PARTICLES; i++) {
      expect(pe.positions[i * 3 + 1]).toBe(-999)
    }
  })

  it('sets all sizes to 0 after reset', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 5; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    pe.reset()
    for (let i = 0; i < MAX_PARTICLES; i++) {
      expect(pe.sizes[i]).toBe(0)
    }
  })
})

describe('ParticleEngine — tick() with isAnimating=false', () => {
  it('never spawns particles when isAnimating=false', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 100; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, false)
    }
    expect(pe.activeCount).toBe(0)
  })

  it('never spawns particles when sources is empty', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 100; i++) {
      pe.tick(0.016, [], DEFAULT_CFG, true)
    }
    expect(pe.activeCount).toBe(0)
  })
})

describe('ParticleEngine — tick() spawning', () => {
  it('spawns particles when isAnimating=true with a source', () => {
    const pe = new ParticleEngine()
    // Run many ticks to accumulate spawn budget
    for (let i = 0; i < 60; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    expect(pe.activeCount).toBeGreaterThan(0)
  })

  it('activeCount never exceeds MAX_PARTICLES', () => {
    const pe = new ParticleEngine()
    const highRateSource: ParticleSource = { x: 0, z: 0, injectionRateMtPerYear: 100 }
    // Run many ticks — should saturate pool without overflowing
    for (let i = 0; i < 10_000; i++) {
      pe.tick(0.016, [highRateSource], DEFAULT_CFG, true)
    }
    expect(pe.activeCount).toBeLessThanOrEqual(MAX_PARTICLES)
  })

  it('spawns from correct well position (positions near source x/z)', () => {
    const pe = new ParticleEngine()
    const src: ParticleSource = { x: 0.5, z: -0.3, injectionRateMtPerYear: 5 }
    for (let i = 0; i < 120; i++) {
      pe.tick(0.016, [src], DEFAULT_CFG, true)
    }
    // At least one live particle should be near the source x position
    let foundNear = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pe.alive[i]) {
        const px = pe.positions[i * 3 + 0]
        if (Math.abs(px - src.x) < 0.5) { foundNear = true; break }
      }
    }
    expect(foundNear).toBe(true)
  })
})

describe('ParticleEngine — particle lifecycle states', () => {
  it('particles eventually transition off inject state (state > 0) after many ticks', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 200; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    // Some alive particles should be past state 0
    let hasRising = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pe.alive[i]) {
        const state = Math.round(pe.data[i * STRIDE + 6])
        if (state >= 1) { hasRising = true; break }
      }
    }
    expect(hasRising).toBe(true)
  })

  it('all particle states are in valid range [0..4]', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 300; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pe.alive[i]) {
        const state = Math.round(pe.data[i * STRIDE + 6])
        expect(state).toBeGreaterThanOrEqual(0)
        expect(state).toBeLessThanOrEqual(4)
      }
    }
  })
})

describe('ParticleEngine — color buffer validity', () => {
  it('all color channels are in [0, 1] for alive particles', () => {
    const pe = new ParticleEngine()
    for (let i = 0; i < 200; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pe.alive[i]) {
        for (let c = 0; c < 3; c++) {
          const v = pe.colors[i * 3 + c]
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('ParticleEngine — caprock barrier', () => {
  it('no alive particle y-position exceeds caprockY', () => {
    const pe = new ParticleEngine()
    // Run long enough for particles to reach caprock and spread
    for (let i = 0; i < 500; i++) {
      pe.tick(0.016, [DEFAULT_SOURCE], DEFAULT_CFG, true)
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (pe.alive[i]) {
        const y = pe.positions[i * 3 + 1]
        // alive particles at y=-999 are technically dead/parked, skip
        if (y > -100) {
          expect(y).toBeLessThanOrEqual(DEFAULT_CFG.caprockY + 0.01)
        }
      }
    }
  })
})
