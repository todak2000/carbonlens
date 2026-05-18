export function hash2D(x: number, y: number, seed: number = 0): number {
  let h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return h - Math.floor(h)
}

export function smoothNoise(x: number, y: number, seed: number = 0): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const n00 = hash2D(ix, iy, seed)
  const n10 = hash2D(ix + 1, iy, seed)
  const n01 = hash2D(ix, iy + 1, seed)
  const n11 = hash2D(ix + 1, iy + 1, seed)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

export function fbm(x: number, y: number, octaves: number = 3, seed: number = 0): number {
  let value = 0
  let amp = 0.6
  let freq = 1
  let max = 0
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq, seed + i * 50)
    max += amp
    amp *= 0.45
    freq *= 2.1
  }
  return value / max
}
