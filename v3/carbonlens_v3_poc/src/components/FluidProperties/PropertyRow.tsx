import React from 'react'

interface Props {
  label: string
  value: React.ReactNode
}

export default function PropertyRow({ label, value }: Props) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-theme/10">
      <span className="text-sm text-secondary font-mono">{label}</span>
      <span className="text-sm text-primary font-mono font-semibold">{value}</span>
    </div>
  )
}
