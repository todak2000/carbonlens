import { describe, it, expect } from 'vitest'
import { buildTopDepthField, structuralClosure } from '../../../engine/classical/structuralDepthMap'

const GRID = { nx: 20, ny: 20, dx_m: 200, dy_m: 200 }

describe('buildTopDepthField', () => {
  it('flat formation returns uniform depth', () => {
    const field = buildTopDepthField({
      grid: GRID, baseDepth_m: 1000, horizonShape: 'flat',
      params: {}, modelWidth_m: 4000, modelLength_m: 4000,
    })
    expect(field.length).toBe(400)
    for (let k = 0; k < field.length; k++) {
      expect(field[k]).toBeCloseTo(1000, 3)
    }
  })

  it('tilted formation has monotone depth gradient', () => {
    const field = buildTopDepthField({
      grid: GRID, baseDepth_m: 1000, horizonShape: 'tilted',
      params: { dipAngle: 5, dipAzimuth: 0 },  // dipping northward
      modelWidth_m: 4000, modelLength_m: 4000,
    })
    // Northward dip (azimuth=0): depth increases in +y direction
    const topRow    = field[0]          // j=0, shallowest
    const bottomRow = field[19 * 20]    // j=19, deepest
    expect(bottomRow).toBeGreaterThan(topRow)
  })

  it('dome has minimum depth at centre', () => {
    const field = buildTopDepthField({
      grid: GRID, baseDepth_m: 2000, horizonShape: 'dome',
      params: { domeRadius: 1000, domeAmplitude: 200 },
      modelWidth_m: 4000, modelLength_m: 4000,
    })
    const centre = field[10 * 20 + 10]
    const corner = field[0]
    // Dome apex is shallowest
    expect(centre).toBeLessThan(corner)
  })

  it('anticline has minimum depth at fold axis', () => {
    const field = buildTopDepthField({
      grid: GRID, baseDepth_m: 1500, horizonShape: 'anticline',
      params: { foldAmplitude: 100, foldWavelength: 8000, foldAxisAzimuth: 0 },
      modelWidth_m: 4000, modelLength_m: 4000,
    })
    const axis  = field[10 * 20 + 10]  // centre (on fold axis for azimuth=0)
    const flank = field[10 * 20 + 0]   // far from axis
    expect(axis).toBeLessThan(flank)
  })

  it('structuralClosure is positive for dome', () => {
    const field = buildTopDepthField({
      grid: GRID, baseDepth_m: 2000, horizonShape: 'dome',
      params: { domeRadius: 1000, domeAmplitude: 200 },
      modelWidth_m: 4000, modelLength_m: 4000,
    })
    const { closure_m } = structuralClosure(field)
    expect(closure_m).toBeGreaterThan(0)
    expect(closure_m).toBeLessThanOrEqual(200)  // <= domeAmplitude
  })

  it('structuralClosure is zero for flat formation', () => {
    const field = buildTopDepthField({
      grid: GRID, baseDepth_m: 1000, horizonShape: 'flat',
      params: {}, modelWidth_m: 4000, modelLength_m: 4000,
    })
    const { closure_m } = structuralClosure(field)
    expect(closure_m).toBeCloseTo(0, 5)
  })
})
