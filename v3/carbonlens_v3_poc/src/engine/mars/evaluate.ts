import { MarsInput, MarsEquation } from './types'

export function hinge(value: number, knot: number, direction: number): number {
  if (direction === 2) return value
  const diff = value - knot
  if (direction === 1) return Math.max(0, diff)
  if (direction === -1) return Math.max(0, -diff)
  return 0
}

function featureValue(input: MarsInput, feature: string): number {
  const value = (input as unknown as Record<string, number>)[feature]
  return value ?? 0
}

export function evaluateMars(input: MarsInput, equation: MarsEquation): number {
  let result = equation.intercept
  for (const term of equation.terms) {
    let termProduct = 1
    for (const h of term.hinges) {
      const fv = featureValue(input, h.feature)
      termProduct *= hinge(fv, h.knot, h.direction)
    }
    result += term.coefficient * termProduct
  }
  return result
}
