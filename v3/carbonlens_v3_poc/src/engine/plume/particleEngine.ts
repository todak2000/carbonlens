/**
 * CO2 Particle Engine — grid-aware particle lifecycle for grid view mode.
 *
 * Particle lifecycle:
 *   emit → rise (buoyant) → caprock hit → lateral spread → trap/recycle
 *
 * Designed to work with the geological model's well positions and the
 * SimulationGrid cell geometry (20×20×10 normalised coords -1 to +1).
 *
 * Pool of MAX_PARTICLES particles, each stored in a flat Float32Array
 * (STRIDE floats per particle) for CPU-cache-friendly iteration.
 */

export const MAX_PARTICLES = 1000
export const STRIDE = 12
// Layout per particle (STRIDE = 12):
//  [0] x         world x (-1 to +1)
//  [1] y         world y (vertical, -1 to +1)
//  [2] z         world z (-1 to +1)
//  [3] vx        velocity x
//  [4] vy        velocity y
//  [5] vz        velocity z
//  [6] state     0=inject 1=rise 2=cap 3=residual 4=dissolving
//  [7] age       seconds alive
//  [8] wellX     well x (for caprock spread direction)
//  [9] wellZ     well z
// [10] opacity   0–1 (used for fade-in/out)
// [11] size      visual size multiplier

export interface ParticleSource {
  /** Normalised well x position (-1 to +1) */
  x: number
  /** Normalised well z position (-1 to +1) */
  z: number
  /** Mt/yr injection rate */
  injectionRateMtPerYear: number
}

export interface ParticleEngineConfig {
  /** Y coordinate of caprock ceiling in scene units */
  caprockY: number
  /** Y coordinate of reservoir bottom in scene units */
  reservoirBottomY: number
  /** Scene half-width (X and Z extent) */
  sceneHalfW: number
  /** Dissolved CO2 fraction (0–1) — drives dissolving state */
  dissolvedFraction: number
  /** Residual trapping fraction (0–1) — drives residual transitions */
  residualFraction: number
}

export class ParticleEngine {
  /** Flat particle data buffer */
  readonly data: Float32Array
  /** Per-particle alive flag */
  readonly alive: Uint8Array
  /** Flat position array for THREE.BufferGeometry (xyz * N) */
  readonly positions: Float32Array
  /** Flat color array for THREE.BufferGeometry (rgb * N) */
  readonly colors: Float32Array
  /** Per-particle size */
  readonly sizes: Float32Array

  private _count = 0
  private _spawnAcc = 0

  constructor() {
    this.data      = new Float32Array(MAX_PARTICLES * STRIDE)
    this.alive     = new Uint8Array(MAX_PARTICLES)
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.colors    = new Float32Array(MAX_PARTICLES * 3)
    this.sizes     = new Float32Array(MAX_PARTICLES)
  }

  get activeCount(): number { return this._count }

  reset(): void {
    this.alive.fill(0)
    this._count = 0
    this._spawnAcc = 0
    // Park all particles below scene
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 1] = -999
      this.sizes[i] = 0
    }
  }

  /**
   * Advance all particles by `dt` seconds.
   * `isAnimating` controls whether new particles are spawned.
   */
  tick(
    dt: number,
    sources: ParticleSource[],
    cfg: ParticleEngineConfig,
    isAnimating: boolean,
  ): void {
    const clampedDt = Math.min(dt, 0.05) * 2.0
    this._spawnParticles(clampedDt, sources, cfg, isAnimating)
    this._updateParticles(clampedDt, cfg, sources)
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _spawnParticles(
    dt: number,
    sources: ParticleSource[],
    cfg: ParticleEngineConfig,
    isAnimating: boolean,
  ): void {
    if (sources.length === 0 || !isAnimating) return
    if (this._count >= MAX_PARTICLES * 0.90) return

    const totalRate = sources.reduce((s, w) => s + w.injectionRateMtPerYear, 0)
    const spawnRate = Math.min(3 + totalRate * 0.8, 8)
    this._spawnAcc += spawnRate * dt

    while (this._spawnAcc >= 1 && this._count < MAX_PARTICLES) {
      this._spawnAcc -= 1
      const slot = this._findFreeSlot()
      if (slot === -1) break

      const src = sources[Math.floor(Math.random() * sources.length)]
      const perfY = cfg.reservoirBottomY + (cfg.caprockY - cfg.reservoirBottomY) * 0.10

      // 40% of particles spawn distributed along the well column (simulating
      // CO2 invading each permeable layer as it rises through the wellbore).
      // 60% spawn at perforation depth as before.
      const isColumnSpawn = Math.random() < 0.40
      const spawnY = isColumnSpawn
        ? cfg.reservoirBottomY + (cfg.caprockY - cfg.reservoirBottomY) * (0.05 + Math.random() * 0.80)
        : perfY + (Math.random() - 0.5) * 0.04

      const angle = Math.random() * Math.PI * 2
      const radR = 0.012 + Math.random() * 0.018
      const base = slot * STRIDE

      this.data[base +  0] = src.x + Math.cos(angle) * radR
      this.data[base +  1] = spawnY
      this.data[base +  2] = src.z + Math.sin(angle) * radR
      // Column-spawned particles: lateral spread at spawn depth + gentle upward drift
      // Perforation-spawned: original radial injection behaviour
      this.data[base +  3] = Math.cos(angle) * (isColumnSpawn ? 0.006 + Math.random() * 0.006 : 0.004 + Math.random() * 0.006)
      this.data[base +  4] = isColumnSpawn ? 0.0015 + Math.random() * 0.0015 : 0.001
      this.data[base +  5] = Math.sin(angle) * (isColumnSpawn ? 0.006 + Math.random() * 0.006 : 0.004 + Math.random() * 0.006)
      this.data[base +  6] = isColumnSpawn ? 1 : 0  // column → rise state, perf → inject state
      this.data[base +  7] = 0
      this.data[base +  8] = src.x
      this.data[base +  9] = src.z
      this.data[base + 10] = 0.0
      this.data[base + 11] = 0.8 + Math.random() * 0.4

      this.alive[slot] = 1
      this._count++
    }
  }

  private _updateParticles(
    dt: number,
    cfg: ParticleEngineConfig,
    sources: ParticleSource[],
  ): void {
    const { caprockY, reservoirBottomY, sceneHalfW } = cfg
    const perfTransitionY = reservoirBottomY + (caprockY - reservoirBottomY) * 0.22

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.alive[i]) {
        this.positions[i * 3 + 1] = -999
        this.sizes[i] = 0
        continue
      }

      const base = i * STRIDE
      const state = this.data[base + 6]
      this.data[base + 7] += dt
      const age = this.data[base + 7]

      // Fade in over first 0.3s
      if (this.data[base + 10] < 1.0) {
        this.data[base + 10] = Math.min(1.0, this.data[base + 10] + dt * 3.5)
      }

      switch (Math.round(state)) {
        case 0: // inject — radial spread from perforation
          this._stepInject(base, dt, perfTransitionY)
          break

        case 1: // rise — buoyant ascent through formation
          this._stepRise(base, dt, caprockY, sceneHalfW)
          break

        case 2: // cap — lateral spread under caprock
          this._stepCap(base, dt, caprockY, sceneHalfW, cfg, i)
          break

        case 3: // residual — stationary, fade out slowly
          this._stepResidual(base, dt, i)
          break

        case 4: // dissolving — sink slowly into brine
          this._stepDissolving(base, dt, reservoirBottomY, i)
          break
      }

      // Write to GPU-facing buffers
      this.positions[i * 3 + 0] = this.data[base + 0]
      this.positions[i * 3 + 1] = this.data[base + 1]
      this.positions[i * 3 + 2] = this.data[base + 2]
      this._writeColor(i, base)
      this.sizes[i] = this.data[base + 11] * this.data[base + 10]
    }
  }

  private _stepInject(base: number, dt: number, perfTransitionY: number): void {
    // Viscous drag decelerates radial spread
    this.data[base + 3] *= Math.pow(0.93, dt * 60)
    this.data[base + 5] *= Math.pow(0.93, dt * 60)
    this.data[base + 0] += this.data[base + 3]
    this.data[base + 1] += this.data[base + 4]
    this.data[base + 2] += this.data[base + 5]

    // Transition to buoyant rise
    if (this.data[base + 7] > 0.6 || this.data[base + 1] > perfTransitionY) {
      this.data[base + 6] = 1
      this.data[base + 4] = 0.004 + Math.random() * 0.004
    }
  }

  private _stepRise(
    base: number,
    dt: number,
    caprockY: number,
    sceneHalfW: number,
  ): void {
    // Lateral wobble + radial invasion (heterogeneous permeability / fingering)
    this.data[base + 3] += (Math.random() - 0.5) * 0.0022 * dt
    this.data[base + 3] *= 0.990
    this.data[base + 5] += (Math.random() - 0.5) * 0.0022 * dt
    this.data[base + 5] *= 0.990

    // Buoyant acceleration
    this.data[base + 4] = Math.min(this.data[base + 4] + 0.0005 * dt, 0.009)

    this.data[base + 0] += this.data[base + 3]
    this.data[base + 1] += this.data[base + 4]
    this.data[base + 2] += this.data[base + 5]

    // Reflect off lateral boundaries
    if (Math.abs(this.data[base + 0]) > sceneHalfW * 0.95) this.data[base + 3] *= -0.8
    if (Math.abs(this.data[base + 2]) > sceneHalfW * 0.95) this.data[base + 5] *= -0.8

    // Hit caprock → transition to lateral spread
    if (this.data[base + 1] >= caprockY) {
      this.data[base + 1] = caprockY - 0.008
      this.data[base + 6] = 2 // cap state

      // Lateral velocity directed away from source well
      const dx = this.data[base + 0] - this.data[base + 8]
      const dz = this.data[base + 2] - this.data[base + 9]
      const d = Math.sqrt(dx * dx + dz * dz) + 0.001
      this.data[base + 3] = (dx / d) * (0.004 + Math.random() * 0.009)
      this.data[base + 5] = (dz / d) * (0.004 + Math.random() * 0.009)
      this.data[base + 4] = 0
      // Size pulse at caprock impact
      this.data[base + 11] *= 1.3
    }
  }

  private _stepCap(
    base: number,
    dt: number,
    caprockY: number,
    sceneHalfW: number,
    cfg: ParticleEngineConfig,
    i: number,
  ): void {
    // Random walk + momentum decay (viscous spreading)
    this.data[base + 3] += (Math.random() - 0.5) * 0.0018 * dt
    this.data[base + 3] *= 0.993
    this.data[base + 5] += (Math.random() - 0.5) * 0.0018 * dt
    this.data[base + 5] *= 0.993

    this.data[base + 0] += this.data[base + 3]
    this.data[base + 1] = caprockY - 0.006 - Math.random() * 0.012
    this.data[base + 2] += this.data[base + 5]

    // Bounce off lateral boundaries
    if (Math.abs(this.data[base + 0]) > sceneHalfW * 0.96) this.data[base + 3] *= -0.8
    if (Math.abs(this.data[base + 2]) > sceneHalfW * 0.96) this.data[base + 5] *= -0.8

    // Probabilistic trapping after spreading for a while
    if (this.data[base + 7] > 3.5) {
      const trapProb = cfg.residualFraction * 0.008 * dt
      const dissProb = cfg.dissolvedFraction * 0.006 * dt
      const rnd = Math.random()
      if (rnd < trapProb) {
        this.data[base + 6] = 3 // residual
      } else if (rnd < trapProb + dissProb) {
        this.data[base + 6] = 4 // dissolving
      }
    }
  }

  private _stepResidual(base: number, dt: number, i: number): void {
    // Trapped — no movement, very slow fade out
    this.data[base + 10] -= dt * 0.07
    if (this.data[base + 10] <= 0) {
      this._recycle(i)
    }
  }

  private _stepDissolving(
    base: number,
    dt: number,
    reservoirBottomY: number,
    i: number,
  ): void {
    // Sinks back into brine (density convection)
    this.data[base + 4] = Math.max(this.data[base + 4] - 0.0003 * dt, -0.005)
    this.data[base + 1] += this.data[base + 4]
    this.data[base + 10] -= dt * 0.12
    if (this.data[base + 10] <= 0 || this.data[base + 1] < reservoirBottomY) {
      this._recycle(i)
    }
  }

  private _recycle(i: number): void {
    this.alive[i] = 0
    this._count = Math.max(0, this._count - 1)
    this.positions[i * 3 + 1] = -999
    this.sizes[i] = 0
  }

  private _findFreeSlot(): number {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.alive[i]) return i
    }
    return -1
  }

  private _writeColor(i: number, base: number): void {
    const state = Math.round(this.data[base + 6])
    const op = this.data[base + 10]
    switch (state) {
      case 0: // inject: hot orange
        this.colors[i * 3 + 0] = 1.0 * op
        this.colors[i * 3 + 1] = 0.45 * op
        this.colors[i * 3 + 2] = 0.05 * op
        break
      case 1: // rise: bright teal (supercritical CO2)
        this.colors[i * 3 + 0] = 0.05 * op
        this.colors[i * 3 + 1] = 0.95 * op
        this.colors[i * 3 + 2] = 0.90 * op
        break
      case 2: // cap: light cyan (plume front under caprock)
        this.colors[i * 3 + 0] = 0.15 * op
        this.colors[i * 3 + 1] = 1.00 * op
        this.colors[i * 3 + 2] = 1.00 * op
        break
      case 3: // residual: green (Land-trapped)
        this.colors[i * 3 + 0] = 0.10 * op
        this.colors[i * 3 + 1] = 0.85 * op
        this.colors[i * 3 + 2] = 0.30 * op
        break
      case 4: // dissolving: blue (brine-dissolved)
        this.colors[i * 3 + 0] = 0.10 * op
        this.colors[i * 3 + 1] = 0.60 * op
        this.colors[i * 3 + 2] = 1.00 * op
        break
      default:
        this.colors[i * 3 + 0] = 0
        this.colors[i * 3 + 1] = 0
        this.colors[i * 3 + 2] = 0
    }
  }
}
