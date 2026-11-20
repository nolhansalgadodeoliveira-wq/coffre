// Conversion entre ce que l'utilisateur tape (« 245,50 ») et des centimes entiers.

const eur = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const eurRound = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** 123450 → « 1 234,50 € ». Les espaces insécables d'Intl sont gardés (pas de retour à la ligne). */
export function formatEuros(cents: number): string {
  return eur.format(cents / 100)
}

/** Version sans centimes, pour les grands chiffres : 123450 → « 1 235 € ». */
export function formatEurosShort(cents: number): string {
  return eurRound.format(Math.round(cents / 100))
}

/** Écart signé : « +12,00 € » ou « −8,50 € ». */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatEuros(0)
  const sign = cents > 0 ? '+' : '−'
  return sign + formatEuros(Math.abs(cents))
}

/**
 * Lit un montant saisi au clavier. Accepte « 245 », « 245,5 », « 245.50 », « 1 245,50 ».
 * Renvoie null si la saisie est vide ou invalide. Arrondi au centime le plus proche.
 */
export function parseEuros(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, '').replace(',', '.')
  if (cleaned === '') return null
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/** Centimes → texte modifiable dans un champ : 24550 → « 245,50 », 24500 → « 245 ». */
export function centsToInput(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100)
  return (cents / 100).toFixed(2).replace('.', ',')
}
