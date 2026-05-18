interface Props {
  label: string
  value: string
}

export default function PropertyRow({ label, value }: Props) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted font-mono">{label}</span>
      <span className="text-[11px] text-secondary font-mono">{value}</span>
    </div>
  )
}
