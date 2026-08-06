import type { ReactNode } from 'react'

interface MobileGuardProps {
  children: ReactNode
}

/**
 * MobileGuard is retained for API compatibility (App.tsx wraps views in it)
 * but no longer blocks small viewports. The application UI is fully
 * responsive, so children always render.
 */
export default function MobileGuard({ children }: MobileGuardProps) {
  return <>{children}</>
}
