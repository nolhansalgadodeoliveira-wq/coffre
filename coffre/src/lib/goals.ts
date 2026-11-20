// Objectifs : symbole automatique, création et modification.

import type { AppData, Goal } from './types'
import { MAX_GOALS } from './types'
import { EMOJI_DATA } from './emojiData'

// Symbole choisi automatiquement d'après le nom de l'objectif, comme la recherche d'emoji de l'iPhone :
// chaque mot tapé est comparé aux noms et mots-clés français de ~1 900 emojis (mot exact, début de mot,
// pluriel, faute de frappe d'une lettre…), et l'emoji qui ressemble le plus est proposé.


/** Quelques choix plus parlants pour des objectifs courants (prioritaires sur la recherche). */
const FAVORITES: Record<string, string> = {
  mariage: '💍', marier: '💍', fiancailles: '💍', ski: '⛷️', moto: '🏍️', voiture: '🚗', auto: '🚗', permis: '🪪', appart: '🏠', appartement: '🏠',
  maison: '🏠', logement: '🏠', loyer: '🏠', voyage: '✈️', vacances: '🏖️', vacance: '🏖️', bebe: '👶', naissance: '👶', epargne: '🐷', urgence: '🛟',
  securite: '🛟', salon: '💈', barbier: '💈', barber: '💈', coiffure: '💈', tondeuse: '💈', console: '🎮', ps5: '🎮', iphone: '📱', telephone: '📱',
  ordi: '💻', ordinateur: '💻', impot: '🧾', impots: '🧾', urssaf: '🧾', omra: '🕋', bled: '🌍', cadeau: '🎁', noel: '🎄', anniversaire: '🎂',
  formation: '🎓', etudes: '🎓', ecole: '🎓', dentiste: '🦷', velo: '🚲', scooter: '🛵', camion: '🚚', van: '🚐', bateau: '⛵', jetski: '🌊',
  concert: '🎤', festival: '🎪', sneakers: '👟', baskets: '👟', chaussures: '👟', parfum: '🧴', tatouage: '🖋️', tattoo: '🖋️', studio: '🏠', pc: '🖥️',
  playstation: '🎮', xbox: '🎮', switch: '🎮', meuble: '🛋️', meubles: '🛋️', demenagement: '📦', caution: '🔑', resto: '🍽️', restaurant: '🍽️', vetements: '👕',
  habits: '👕', fringues: '👕', shopping: '🛍️', sport: '🏋️', salle: '🏋️', muscu: '🏋️', bourse: '📈', crypto: '🪙', bitcoin: '🪙', retraite: '🌅', dette: '💳',
  credit: '🏦', assurance: '🛡️', banque: '🏦', motocross: '🏍️', quad: '🏍️', jeux: '🎮', jeu: '🎮', livres: '📚', lunettes: '👓', montre: '⌚',
}
/** Mots trop vagues seuls : leur emoji ne passe qu'après ceux des autres mots. */
const WEAK: Record<string, string> = { materiel: '🧰', outil: '🧰', outils: '🧰' }

/** Expressions de plusieurs mots. */
const PHRASES: [string, string][] = [
  ['lune de miel', '💑'], ['coup dur', '🛟'], ['jet ski', '🌊'], ['camping car', '🚐'], ['road trip', '🛣️'], ['week end', '🧳'], ['new york', '🗽'], ['salle de sport', '🏋️'], ['appareil photo', '📷'], ['permis de conduire', '🪪'],
]
/** Les emojis existent avec ou sans « sélecteur de variante » invisible : on les compare sans lui. */
const bare = (e: string) => e.replace(/\uFE0F/g, '')

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'un', 'une', 'ma', 'mon', 'mes', 'ta', 'ton', 'tes', 'sa', 'son', 'ses', 'pour', 'par', 'sur', 'avec', 'nouveau', 'nouvelle', 'nouvel', 'futur', 'future', 'mini', 'petit', 'petite', 'grand', 'grande', 'gros', 'projet', 'objectif'])

const normalize = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

interface EmojiEntry {
  emoji: string
  label: string
  /** Mots du nom de l'emoji. */
  labelWords: string[]
  /** Mots des mots-clés. */
  tagWords: string[]
  order: number
}

let entries: EmojiEntry[] | null = null
function data(): EmojiEntry[] {
  entries ??= EMOJI_DATA.split('\n').map((line, order) => {
    const [emoji, label, tags = ''] = line.split('|')
    return { emoji, label, labelWords: label.split(' '), tagWords: [...new Set(tags.split(/[ ,]/).filter(Boolean))], order }
  })
  return entries
}

/** Distance d'édition (fautes de frappe), limitée : renvoie max+1 dès qu'on dépasse. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** Ressemblance entre un mot tapé et un mot d'emoji (0 = aucune). */
function wordScore(q: string, w: string): number {
  if (q === w) return 100
  if (w.startsWith(q)) return q.length >= 2 ? 60 + Math.min(20, q.length * 4) - (w.length - q.length) : 0 // en cours de frappe
  if (q.startsWith(w) && w.length >= 3 && q.length - w.length <= 2) return 70 // pluriel, féminin (« motos », « skieuse »)
  if (q.length >= 4 && w.length >= 4) {
    const d = distance(q, w, 2)
    if (d === 1) return 50 // une faute de frappe
    if (d === 2 && q.length >= 7) return 35
  }
  return 0
}

/**
 * Emojis qui ressemblent le plus au nom donné, du meilleur au moins bon.
 * Le nom de l'emoji compte plus que ses mots-clés ; un emoji au nom court passe devant (« moto » avant « fauteuil motorisé »).
 */
export function emojiSearch(name: string, limit = 8): string[] {
  const words = normalize(name)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
  if (words.length === 0) return []
  const scored: { emoji: string; score: number; order: number }[] = []
  for (const e of data()) {
    let total = 0
    let matched = 0
    for (const q of words) {
      let best = 0
      for (const w of e.labelWords) best = Math.max(best, wordScore(q, w) * 1.2)
      for (const w of e.tagWords) best = Math.max(best, wordScore(q, w))
      if (best > 0) matched++
      total += best
    }
    if (total <= 0) continue
    // Le nom entier de l'emoji correspond exactement : très bon signe.
    if (e.label === words.join(' ')) total += 60
    // Préférence aux emojis simples (nom court) et à ceux qui correspondent à plusieurs mots tapés.
    total += matched * 15 - e.labelWords.length * 3
    scored.push({ emoji: e.emoji, score: total, order: e.order })
  }
  // Choix préférés : expression connue, ou mot connu (avec son pluriel).
  const text = ` ${normalize(name)} `
  for (const [k, emoji] of PHRASES) if (text.includes(` ${k} `)) scored.push({ emoji, score: 1000, order: -1 })
  for (const q of words) {
    const fav = FAVORITES[q] ?? FAVORITES[q.replace(/(s|x)$/, '')]
    if (fav) scored.push({ emoji: fav, score: 500, order: -1 })
    else if (WEAK[q]) scored.push({ emoji: WEAK[q], score: 150, order: -1 })
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order)
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of scored) {
    if (seen.has(bare(x.emoji))) continue
    seen.add(bare(x.emoji))
    out.push(x.emoji)
    if (out.length >= limit) break
  }
  return out
}

/** Symbole le plus ressemblant au nom de l'objectif. 🎯 si rien ne correspond. */
export function emojiFor(name: string): string {
  return emojiSearch(name, 1)[0] ?? '🎯'
}

const newGoalId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export type GoalInput = Pick<Goal, 'name' | 'emoji' | 'amount' | 'date'>

/** Ajoute ou modifie un objectif. Renvoie un message d'erreur, ou null. */
export function validateGoal(g: GoalInput, today: string, isNew: boolean): string | null {
  if (!g.name.trim()) return 'Donne un nom à ton objectif.'
  if (!(g.amount > 0)) return 'Indique le montant à mettre de côté.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.date)) return 'Choisis une date valide.'
  if (isNew && g.date <= today) return 'Choisis une date dans le futur.'
  return null
}

export function saveGoal(d: AppData, input: GoalInput, now: string, id?: string): AppData {
  const clean = { ...input, name: input.name.trim().slice(0, 40) }
  const goals = id
    ? d.settings.goals.map((g) => (g.id === id ? { ...g, ...clean } : g))
    : [...d.settings.goals, { id: newGoalId(), createdAt: now, ...clean }].slice(0, MAX_GOALS)
  return { ...d, settings: { ...d.settings, goals, updatedAt: now } }
}

export function removeGoal(d: AppData, id: string, now: string): AppData {
  return { ...d, settings: { ...d.settings, goals: d.settings.goals.filter((g) => g.id !== id), updatedAt: now } }
}

/** Objectif réalisé : l'argent qui lui était réservé est considéré comme utilisé. */
export function completeGoal(d: AppData, id: string, spent: number, now: string): AppData {
  return { ...d, settings: { ...d.settings, goals: d.settings.goals.map((g) => (g.id === id ? { ...g, done: { at: now, spent } } : g)), updatedAt: now } }
}

/** Annule « réalisé » : l'argent revient dans l'épargne. */
export function reopenGoal(d: AppData, id: string, now: string): AppData {
  return { ...d, settings: { ...d.settings, goals: d.settings.goals.map((g) => (g.id === id ? { id: g.id, name: g.name, emoji: g.emoji, amount: g.amount, date: g.date, createdAt: g.createdAt } : g)), updatedAt: now } }
}
