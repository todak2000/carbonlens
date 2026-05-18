import { MarsInput, FeatureScaler } from './types'

function scaleFeature(value: number, params: { min: number; max: number }, scaleMin: number, scaleMax: number): number {
  const featureMin = params.min
  const featureMax = params.max
  if (featureMax === featureMin) return 0
  const normalized = (value - featureMin) / (featureMax - featureMin)
  return normalized * (scaleMax - scaleMin) + scaleMin
}

export function scaleInput(input: MarsInput, scaler: FeatureScaler): MarsInput {
  const scaled: Record<string, number> = {}
  for (const feature of scaler.feature_cols) {
    const raw = input[feature] ?? 0
    const params = scaler.params[feature]
    if (!params) {
      scaled[feature] = raw
      continue
    }
    scaled[feature] = scaleFeature(raw, params, scaler.scale_min, scaler.scale_max)
  }
  return scaled as unknown as MarsInput
}
