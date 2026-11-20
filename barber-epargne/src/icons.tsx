// Icônes au trait, dessinées à la main sur une grille de 24 px. Couleur = currentColor.

import type { ReactNode } from 'react'

function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const IconHome = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <path d="M10 20.5v-5h4v5" />
  </Svg>
)

export const IconCalendar = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
)

export const IconChart = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M8.5 16.5v-4M12 16.5v-8M15.5 16.5v-6" />
  </Svg>
)

export const IconList = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
)

export const IconUser = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5c.8-3.6 3.8-5.8 7.5-5.8s6.7 2.2 7.5 5.8" />
  </Svg>
)

export const IconPlus = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconArrow = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)

export const IconChevronLeft = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)

export const IconChevronRight = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)

export const IconCheck = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
)

export const IconCoin = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.8 9.2a3.6 3.6 0 1 0 0 5.6M8 11h5M8 13.2h5" />
  </Svg>
)

export const IconStar = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M12 4.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.8l5-.7z" />
  </Svg>
)

export const IconScissors = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="6.5" cy="7" r="2.8" />
    <circle cx="6.5" cy="17" r="2.8" />
    <path d="M8.8 8.6 20 17M8.8 15.4 20 7" />
  </Svg>
)

export const IconTrend = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M4 16.5l5-5 3.5 3.5L20 7.5" />
    <path d="M15 7.5h5v5" />
  </Svg>
)
