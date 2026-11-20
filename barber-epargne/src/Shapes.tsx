// Formes décoratives au rendu « 3D » doux (dégradés radiaux), comme sur les modèles :
// un anneau orange, une sphère rose, une pièce, un petit anneau jaune. Purement décoratif.

export default function Shapes({ className = '', variant = 'hero' }: { className?: string; variant?: 'hero' | 'small' | 'stack' }) {
  const id = `s-${variant}`
  const defs = (
    <defs>
      <radialGradient id={`${id}-orange`} cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffe1a8" />
        <stop offset="45%" stopColor="#ffa53a" />
        <stop offset="100%" stopColor="#d9661a" />
      </radialGradient>
      <radialGradient id={`${id}-hole`} cx="60%" cy="65%" r="70%">
        <stop offset="0%" stopColor="#ff8f2a" />
        <stop offset="100%" stopColor="#a84a0c" />
      </radialGradient>
      <radialGradient id={`${id}-pink`} cx="32%" cy="28%" r="80%">
        <stop offset="0%" stopColor="#fff4fd" />
        <stop offset="40%" stopColor="#f3c3ec" />
        <stop offset="100%" stopColor="#b97ab4" />
      </radialGradient>
      <radialGradient id={`${id}-dark`} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#8c90a8" />
        <stop offset="55%" stopColor="#4a4e66" />
        <stop offset="100%" stopColor="#25283a" />
      </radialGradient>
      <linearGradient id={`${id}-yellow`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff38a" />
        <stop offset="100%" stopColor="#e8c51a" />
      </linearGradient>
      <radialGradient id={`${id}-coin`} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#f2f0ff" />
        <stop offset="50%" stopColor="#c9bcff" />
        <stop offset="100%" stopColor="#7d68d8" />
      </radialGradient>
      <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  )

  if (variant === 'small') {
    return (
      <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
        {defs}
        <ellipse cx="62" cy="104" rx="40" ry="7" fill="#000" opacity="0.12" filter={`url(#${id}-blur)`} />
        <circle cx="70" cy="56" r="38" fill={`url(#${id}-pink)`} />
        <circle cx="34" cy="86" r="16" fill={`url(#${id}-dark)`} />
        <circle cx="52" cy="98" r="9" fill={`url(#${id}-orange)`} />
      </svg>
    )
  }

  if (variant === 'stack') {
    return (
      <svg viewBox="0 0 140 140" className={className} aria-hidden="true">
        {defs}
        <ellipse cx="72" cy="126" rx="46" ry="7" fill="#000" opacity="0.14" filter={`url(#${id}-blur)`} />
        <ellipse cx="72" cy="104" rx="44" ry="14" fill="#5b45c9" />
        <ellipse cx="72" cy="98" rx="44" ry="14" fill={`url(#${id}-coin)`} />
        <ellipse cx="68" cy="76" rx="38" ry="12" fill="#5b45c9" />
        <ellipse cx="68" cy="70" rx="38" ry="12" fill={`url(#${id}-coin)`} />
        <ellipse cx="74" cy="50" rx="32" ry="10" fill="#5b45c9" />
        <ellipse cx="74" cy="44" rx="32" ry="10" fill={`url(#${id}-coin)`} />
        <circle cx="112" cy="26" r="12" fill="none" stroke={`url(#${id}-yellow)`} strokeWidth="7" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      {defs}
      <ellipse cx="104" cy="186" rx="70" ry="9" fill="#000" opacity="0.14" filter={`url(#${id}-blur)`} />
      {/* anneau orange, vu en biais */}
      <g transform="rotate(-24 128 58)">
        <ellipse cx="128" cy="58" rx="44" ry="38" fill={`url(#${id}-orange)`} />
        <ellipse cx="134" cy="56" rx="17" ry="15" fill={`url(#${id}-hole)`} />
      </g>
      {/* sphère rose */}
      <circle cx="112" cy="124" r="50" fill={`url(#${id}-pink)`} />
      {/* petite sphère sombre */}
      <circle cx="58" cy="150" r="24" fill={`url(#${id}-dark)`} />
      {/* anneau jaune */}
      <circle cx="46" cy="92" r="20" fill="none" stroke={`url(#${id}-yellow)`} strokeWidth="11" />
    </svg>
  )
}
