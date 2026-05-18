import { GeometryType } from '../types'

export function getDeformation(type: GeometryType, x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z) / 1.5
  if (type === 'anticline') return 0.35 * Math.sin(x * Math.PI / 1.5) * Math.cos(z * Math.PI / 2.5)
  if (type === 'dome') return 0.38 * Math.max(0, 1 - dist * dist)
  if (type === 'fault') {
    const smoothStep = Math.max(0, Math.min(1, (x + 0.15) / 0.3))
    return smoothStep * 0.28 - (1 - smoothStep) * 0.12
  }
  if (type === 'stratigraphic') {
    const pinch = Math.max(0, Math.min(1, (x + 1.5) / 3))
    return 0.32 * pinch * (1 + 0.15 * Math.sin(z * Math.PI * 2))
  }
  if (type === 'channel') {
    const channel = Math.sin(x * Math.PI * 0.8) * 0.5 + Math.sin(z * Math.PI * 1.2) * 0.3
    const pointBar = Math.max(0, 1 - Math.abs(channel + x * 0.3)) * 0.15
    return 0.08 + channel * 0.12 + pointBar
  }
  if (type === 'gridfile') return 0
  return 0.12 * (Math.sin(x * Math.PI * 2) * Math.cos(z * Math.PI * 2) + 0.5 * Math.sin(x * Math.PI * 4 + 1) * 0.5)
}

export function getGridDeformation(x: number, z: number, deformations: number[][], nx: number, nz: number): number {
  const ix = Math.max(0, Math.min(nx - 1, Math.floor(((x + 1.5) / 3) * nx)))
  const iz = Math.max(0, Math.min(nz - 1, Math.floor(((z + 1.5) / 3) * nz)))
  return deformations[iz][ix] * 0.5
}
