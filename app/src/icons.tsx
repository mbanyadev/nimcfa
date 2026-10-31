/** Stroke icons from the NimCFA design export (24px grid, 2.75 stroke, round caps). */
const P = {
  close: <path d="M18 6 6 18M6 6l12 12" />,
  out: <path d="M7 7h10v10M7 17 17 7" />,
  in: <path d="M17 7 7 17M17 17H7V7" />,
  check: <path d="M20 6 9 17l-5-5" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  refund: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  phone: <><rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" /></>,
  alert: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
  ext: <path d="M7 17 17 7M8 7h9v9" />,
} as const
export type IconName = keyof typeof P
export function Icon({ name, size = 22 }: { name: IconName, size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>{P[name]}</svg>
  )
}

/** Nimiq-style gold hexagon mark. */
export function Hex({ className, children }: { className?: string, children?: React.ReactNode }) {
  return <span className={`hex ${className ?? ''}`}>{children}</span>
}

/** Phone + coins illustration for the image slots of the design (home banner, top-up). */
export function MomoArt({ size, bg = '#fff' }: { size: number, bg?: string }) {
  const id = `lat${bg.replace('#', '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden className="art">
      <defs>
        <clipPath id={`c${id}`}><circle cx="100" cy="100" r="98" /></clipPath>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0h14M0 0v14" stroke="#E9B213" strokeWidth="2" />
        </pattern>
      </defs>
      <circle cx="100" cy="100" r="98" fill={bg} />
      <g clipPath={`url(#c${id})`}><circle cx="160" cy="40" r="70" fill={`url(#${id})`} opacity=".45" /></g>
      {/* phone */}
      <rect x="64" y="34" width="74" height="128" rx="16" fill="#1F2348" />
      <rect x="70" y="46" width="62" height="104" rx="9" fill="#FBF7EF" />
      <rect x="92" y="39" width="18" height="3" rx="1.5" fill="#3a3f72" />
      <polygon points="92,60 110,60 119,74 110,88 92,88 83,74" fill="#E9B213" />
      <path d="M93 74l5 5 10-10" stroke="#1F2348" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="80" y="100" width="42" height="7" rx="3.5" fill="#1F2348" opacity=".85" />
      <rect x="86" y="113" width="30" height="5" rx="2.5" fill="#c9c4b8" />
      <rect x="78" y="128" width="46" height="13" rx="6.5" fill="#E9B213" />
      {/* FCFA coin stack (MTN yellow, Orange) */}
      <ellipse cx="150" cy="160" rx="24" ry="8" fill="#cf6400" />
      <rect x="126" y="148" width="48" height="12" fill="#FF7900" />
      <ellipse cx="150" cy="148" rx="24" ry="8" fill="#ff9a3d" />
      <ellipse cx="150" cy="140" rx="24" ry="8" fill="#d9ad00" />
      <rect x="126" y="128" width="48" height="12" fill="#FFCC00" />
      <ellipse cx="150" cy="128" rx="24" ry="8" fill="#ffe066" />
      <text x="150" y="131" textAnchor="middle" fontSize="9" fontWeight="800" fill="#7a5d07" fontFamily="Mulish Variable, sans-serif">FCFA</text>
      {/* NIM coin */}
      <circle cx="50" cy="146" r="25" fill="#cf9e10" />
      <circle cx="50" cy="142" r="25" fill="#E9B213" />
      <polygon points="42,128 58,128 66,142 58,156 42,156 34,142" fill="none" stroke="#1F2348" strokeWidth="4" strokeLinejoin="round" />
      {/* sparkles */}
      <circle cx="40" cy="62" r="5" fill="#007A5E" />
      <circle cx="166" cy="92" r="4" fill="#CE1126" />
      <path d="M150 52l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#E9B213" />
    </svg>
  )
}
