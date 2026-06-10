/**
 * Land (1968) residual trapping model.
 *
 * When the CO2 plume migrates (drainage cycle) and brine imbibes back
 * (imbibition cycle), a fraction of CO2 is snap-off trapped as disconnected
 * ganglia in pore throats. These ganglia are permanently immobile.
 *
 * Reference: Land, C.S. (1968). Calculation of imbibition relative permeability
 * for two- and three-phase flow from rock properties. SPE-1942-PA.
 */

/**
 * Compute the Land coefficient C from drainage Sg_max and imbibition Sgr.
 *
 * The Land coefficient relates the maximum drainage saturation to the
 * residual saturation after imbibition:
 *   C = (1/Sgr_trapped) - (1/Sg_max)
 *
 * Typical values: C = 1 (tight carbonate) to 5 (high-k sandstone).
 * Lower C = more trapping.
 *
 * @param Sg_max  Maximum free CO2 saturation reached during drainage
 * @param C_land  Land coefficient (dimensionless, 1–5; defaults to 2.5)
 */
export function computeResidualSaturation(Sg_max: number, C_land = 2.5): number {
  if (Sg_max <= 0) return 0
  // From Land (1968): Sgr = Sg_max / (1 + C × Sg_max)
  return Sg_max / (1 + C_land * Sg_max)
}

/**
 * Per-cell Land trapping state. Maintained in the flow solver across timesteps.
 */
export interface LandState {
  /** Maximum free-CO2 saturation ever reached (the drainage peak) */
  Sg_max: number
  /** Residual saturation computed from Sg_max at imbibition onset */
  Sgr_trapped: number
  /** Whether this cell is currently in imbibition phase */
  inImbibition: boolean
  /** Land coefficient for this cell (lithology-dependent) */
  C_land: number
  /** Previous-step saturation for imbibition onset detection */
  Sg_old_approx: number
}

/** Create a fresh LandState for a cell */
export function makeLandState(C_land = 2.5): LandState {
  return { Sg_max: 0, Sgr_trapped: 0, inImbibition: false, C_land, Sg_old_approx: 0 }
}

/**
 * Apply Land trapping to a single cell for one timestep.
 *
 * Returns the effective Sg after trapping, and updates the LandState in place.
 *
 * @param Sg_new     Proposed new saturation after advection
 * @param Sg_old     Saturation at start of this timestep (before advection)
 * @param state      Land state for this cell (mutated in place)
 * @returns          { Sg_free, Sg_residual_newly_locked }
 */
export function applyLandTrapping(
  Sg_new: number,
  Sg_old: number,
  state: LandState,
): { Sg_free: number; newlyTrapped: number } {
  // Update drainage peak
  if (Sg_new > state.Sg_max) {
    state.Sg_max = Sg_new
    state.inImbibition = false
    state.Sgr_trapped = computeResidualSaturation(state.Sg_max, state.C_land)
  }

  // Detect imbibition onset: saturation is falling from its peak
  if (!state.inImbibition && Sg_new < state.Sg_old_approx) {
    state.inImbibition = true
    state.Sgr_trapped = computeResidualSaturation(state.Sg_max, state.C_land)
  }

  // During imbibition, enforce that free CO2 cannot fall below Sgr
  if (state.inImbibition && Sg_new < state.Sgr_trapped) {
    const Sg_free = state.Sgr_trapped
    const newlyTrapped = 0  // already reached residual — no additional trapping
    return { Sg_free, newlyTrapped }
  }

  return { Sg_free: Sg_new, newlyTrapped: 0 }
}

// Augment LandState with a previous-step tracker (used internally)
declare module './landTrapping' {
  interface LandState {
    Sg_old_approx: number
  }
}

/** Advance the Land state's previous-step tracker */
export function tickLandState(state: LandState, Sg_current: number): void {
  state.Sg_old_approx = Sg_current
}

/**
 * Simplified batch version: given free saturation, Land C coefficient, and
 * drainage peak, directly compute how much is permanently trapped.
 *
 * Used for cells where we only track residual budget (not full Land curve).
 */
export function landResidualFraction(C_land: number): number {
  // Fraction of a cell's peak drainage saturation that gets trapped
  // For a typical Sg_max ~ 0.4 and C = 2.5: Sgr = 0.4/2.0 = 0.20 → ~50% trapped
  // Returns fraction [0–1] of total injected CO2 that becomes residual
  return 1 / (1 + C_land * 0.5)  // evaluated at nominal Sg_max = 0.5
}
