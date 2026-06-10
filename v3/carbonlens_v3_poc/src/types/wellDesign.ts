/**
 * Well design data model for the CarbonLens wellbore schematic generator.
 *
 * Captures the minimum information needed to render a credible regulatory-grade
 * wellbore schematic: casing strings, cement, perforations, and formation zones.
 */

export interface CasingString {
  /** Display name, e.g. "Surface", "Intermediate", "Injection Liner" */
  name: string
  /** Nominal outer diameter (inches) */
  outerDiameter_in: number
  /** Nominal inner diameter (inches) */
  innerDiameter_in: number
  /** Top of casing (measured depth from rotary table, metres) */
  topDepth_m: number
  /** Bottom of casing (metres) */
  bottomDepth_m: number
  /** Top of cement behind this string (metres) — cement fills from here to bottom */
  cementTopDepth_m: number
  /** True if this is the perforated / screened interval */
  isInjectionString?: boolean
}

export interface WellDesign {
  /** Total drilled depth (metres, from surface) */
  totalDepth_m: number
  /** Top of reservoir formation (metres) */
  reservoirTopDepth_m: number
  /** Bottom of reservoir formation (metres) */
  reservoirBottomDepth_m: number
  /** Top of caprock seal (metres) */
  caprockTopDepth_m: number
  /** Bottom of caprock (= reservoir top) (metres) */
  caprockBottomDepth_m: number
  /** Shallowest perforation / open-hole completion (metres) */
  perforationTopDepth_m: number
  /** Deepest perforation (metres) */
  perforationBottomDepth_m: number
  /** Ordered from largest (shallowest) to smallest (deepest) diameter */
  casingStrings: CasingString[]
}

/**
 * Generate a sensible default well design from formation parameters.
 * Follows standard CCUS well architecture:
 *   Surface casing  → set below freshwater aquifer (~20% of depth)
 *   Intermediate    → set ~50m above caprock top
 *   Injection liner → across caprock + full reservoir interval
 */
export function defaultWellDesign(depthToReservoir: number, thickness: number): WellDesign {
  const td              = depthToReservoir + thickness
  const caprockTop      = Math.max(50, depthToReservoir - Math.max(30, depthToReservoir * 0.04))
  const caprockBottom   = depthToReservoir
  const surfaceCasingBtm = Math.min(300, depthToReservoir * 0.20)
  const intermBtm       = Math.max(surfaceCasingBtm + 100, caprockTop - 50)

  return {
    totalDepth_m:             td,
    reservoirTopDepth_m:      depthToReservoir,
    reservoirBottomDepth_m:   td,
    caprockTopDepth_m:        caprockTop,
    caprockBottomDepth_m:     caprockBottom,
    perforationTopDepth_m:    depthToReservoir + thickness * 0.15,
    perforationBottomDepth_m: depthToReservoir + thickness * 0.85,
    casingStrings: [
      {
        name:              'Surface Casing',
        outerDiameter_in:  13.375,
        innerDiameter_in:  12.415,
        topDepth_m:        0,
        bottomDepth_m:     surfaceCasingBtm,
        cementTopDepth_m:  0,
      },
      {
        name:              'Intermediate Casing',
        outerDiameter_in:  9.625,
        innerDiameter_in:  8.835,
        topDepth_m:        0,
        bottomDepth_m:     intermBtm,
        cementTopDepth_m:  0,
      },
      {
        name:              'CO₂ Injection Liner',
        outerDiameter_in:  7.0,
        innerDiameter_in:  6.276,
        topDepth_m:        intermBtm - 30,      // 30 m overlap with intermediate
        bottomDepth_m:     td,
        cementTopDepth_m:  caprockTop - 20,     // cement across caprock for barrier
        isInjectionString: true,
      },
    ],
  }
}
