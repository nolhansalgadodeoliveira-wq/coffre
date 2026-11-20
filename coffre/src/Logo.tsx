/** Logo « Coffre » : une pièce dans un anneau ouvert, encre sur lavande. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Coffre">
      <rect width="512" height="512" rx="140" fill="var(--violet)" />
      <circle
        cx="256"
        cy="256"
        r="120"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="56"
        strokeLinecap="round"
        strokeDasharray="565 754"
        transform="rotate(45 256 256)"
      />
      <circle cx="256" cy="256" r="28" fill="var(--ink)" />
    </svg>
  )
}
