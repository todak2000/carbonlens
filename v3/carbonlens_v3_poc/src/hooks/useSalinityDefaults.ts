import { useMemo } from 'react'
import { SaltType } from '../types'

const DEFAULT_SPLITS: Record<SaltType, { monovalent: number; bivalent: number }> = {
  NaCl: { monovalent: 0.15, bivalent: 0 },
  CaCl2: { monovalent: 0, bivalent: 0.15 },
  Mixed: { monovalent: 0.12, bivalent: 0.03 },
}

export function useSalinityDefaults(saltType: SaltType, totalSalinity: number) {
  return useMemo(() => {
    const split = DEFAULT_SPLITS[saltType]
    const ratio = totalSalinity / (split.monovalent + split.bivalent || 1)
    return {
      monovalent: split.monovalent * ratio,
      bivalent: split.bivalent * ratio,
    }
  }, [saltType, totalSalinity])
}
