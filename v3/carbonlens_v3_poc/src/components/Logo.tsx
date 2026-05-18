interface Props {
  width?: number
  iconOnly?: boolean
  className?: string
}

export default function Logo({ width = 200, iconOnly, className }: Props) {
  if (iconOnly) {
    return (
      <svg width={28} height={28} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="24" cy="24" r="9" fill="none" stroke="#00b89a" strokeWidth="1.8" />
        <circle cx="24" cy="24" r="3.5" fill="#00b89a" />
        <circle cx="8" cy="24" r="5" fill="none" stroke="#00d4b4" strokeWidth="1.4" opacity="0.7" />
        <circle cx="8" cy="24" r="1.8" fill="#00d4b4" opacity="0.7" />
        <circle cx="40" cy="24" r="5" fill="none" stroke="#00d4b4" strokeWidth="1.4" opacity="0.7" />
        <circle cx="40" cy="24" r="1.8" fill="#00d4b4" opacity="0.7" />
        <line x1="13" y1="24" x2="15.5" y2="24" stroke="#00d4b4" strokeWidth="2.2" opacity="0.8" />
        <line x1="32.5" y1="24" x2="35" y2="24" stroke="#00d4b4" strokeWidth="2.2" opacity="0.8" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(0,184,154,0.22)" strokeWidth="0.9" strokeDasharray="2.5 3.5" />
      </svg>
    )
  }

  return (
    <svg width={width} viewBox="0 0 240 48" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g transform="translate(0,2)">
        <circle cx="21" cy="22" r="9" fill="none" stroke="#00b89a" strokeWidth="1.8" />
        <circle cx="21" cy="22" r="3.5" fill="#00b89a" />
        <circle cx="5" cy="22" r="5" fill="none" stroke="#00d4b4" strokeWidth="1.4" opacity="0.7" />
        <circle cx="5" cy="22" r="1.8" fill="#00d4b4" opacity="0.7" />
        <circle cx="37" cy="22" r="5" fill="none" stroke="#00d4b4" strokeWidth="1.4" opacity="0.7" />
        <circle cx="37" cy="22" r="1.8" fill="#00d4b4" opacity="0.7" />
        <line x1="10" y1="22" x2="12.5" y2="22" stroke="#00d4b4" strokeWidth="2.2" opacity="0.8" />
        <line x1="29.5" y1="22" x2="32" y2="22" stroke="#00d4b4" strokeWidth="2.2" opacity="0.8" />
        <circle cx="21" cy="22" r="18" fill="none" stroke="rgba(0,184,154,0.22)" strokeWidth="0.9" strokeDasharray="2.5 3.5" />
      </g>
      <text x="48" y="23" fontFamily="'IBM Plex Mono', monospace" fontSize="19" fontWeight="700" fill="currentColor" letterSpacing="0.5" className="text-primary">CARBON</text>
      <text x="48" y="40" fontFamily="'IBM Plex Mono', monospace" fontSize="19" fontWeight="300" fill="#00b89a" letterSpacing="4.5">LENS</text>
    </svg>
  )
}
