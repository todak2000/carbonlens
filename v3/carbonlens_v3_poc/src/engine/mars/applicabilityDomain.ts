import type { MarsInput, FeatureScaler, PhaseRegime, ADResult, ADViolation } from './types'
import { subScaler } from './subModel'
import { supScaler } from './supModel'

const CONTINUOUS_FEATURES: (keyof MarsInput)[] = ['Pr', 'Tr', 'MCM', 'BCM', 'x_CH4', 'x_N2', 'drho_sq']

// 90% conformal prediction interval half-width calibrated from MARS IFT paper.
// Baseline ±2.5 mN/m for in-domain inputs; scales linearly with max exceedance fraction.
const BASE_PI_HALFWIDTH = 2.5 // mN/m

export function assessApplicabilityDomain(rawInput: MarsInput, regime: PhaseRegime): ADResult {
  const scaler: FeatureScaler = regime === 'subcritical' ? subScaler : supScaler

  const violations: ADViolation[] = []
  let maxExceedance = 0

  for (const feat of CONTINUOUS_FEATURES) {
    const bounds = scaler.params[feat]
    if (!bounds) continue
    const val = (rawInput as unknown as Record<string, number>)[feat] ?? 0
    const range = bounds.max - bounds.min
    if (range <= 0) continue

    if (val < bounds.min) {
      const pct = (bounds.min - val) / range
      violations.push({ feature: feat, value: val, min: bounds.min, max: bounds.max, pct_outside: pct })
      if (pct > maxExceedance) maxExceedance = pct
    } else if (val > bounds.max) {
      const pct = (val - bounds.max) / range
      violations.push({ feature: feat, value: val, min: bounds.min, max: bounds.max, pct_outside: pct })
      if (pct > maxExceedance) maxExceedance = pct
    }
  }

  // green  = fully in domain
  // yellow = marginally outside (≤15% of feature range beyond bound)
  // red    = significantly outside (>15%)
  const status: ADResult['status'] =
    violations.length === 0 ? 'green' :
    maxExceedance <= 0.15 ? 'yellow' : 'red'

  const pi_halfwidth =
    status === 'green'
      ? BASE_PI_HALFWIDTH
      : status === 'yellow'
        ? Math.round(BASE_PI_HALFWIDTH * (1 + maxExceedance * 4) * 100) / 100
        : Math.round(BASE_PI_HALFWIDTH * (1 + maxExceedance * 10) * 100) / 100

  return { status, pi_halfwidth, pi_level: 0.90, violations }
}
