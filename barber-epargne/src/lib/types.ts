// Tous les montants sont stockés en CENTIMES (entiers) pour éviter les erreurs
// d'arrondi des nombres à virgule (0,1 + 0,2 ≠ 0,3 en JavaScript).
//
// Version 2 : le suivi se fait par JOURNÉE travaillée (n'importe quel jour de la semaine),
// et non plus par week-end. Les anciennes données sont converties automatiquement (storage.ts).

export type DayStatus = 'repos' | 'prevu' | 'extra'

/** Une journée travaillée. Une seule par date. */
export interface Entry {
  id: string
  /** AAAA-MM-JJ */
  date: string
  /** Montant encaissé ce jour-là (avant partage), en centimes. */
  gross: number
  /** Ta part, en centimes : encaissé × part gardée, figée au moment de la saisie. */
  amount: number
  clients?: number
  /**
   * Détail de l'encaissé par catégorie de recette (id → centimes). Le reste de `gross` revient à la
   * première catégorie (coupes au salon pour un barbier, installations pour un climaticien…).
   */
  parts?: Record<string, number>
  /** Part gardée CE jour-là, en % (si différente des réglages ; sinon celle des réglages au moment de la saisie). */
  keepPct?: number
  /** Pourboires du jour, en centimes : ils s'ajoutent entiers à ta part (pas partagés). Déjà inclus dans `amount`. */
  tips?: number
  /** Dernière modification (ISO) : sert à garder la version la plus récente entre deux appareils. */
  updatedAt: string
}

/** Une catégorie de recette ou de dépense, choisie selon le métier (modifiable). */
export interface CategoryDef {
  id: string
  label: string
  emoji: string
  /** 'tips' : pourboires (gardés à 100 %, saisis à part) ; 'home' : à domicile (part gardée propre). */
  kind?: 'tips' | 'home'
}

/** Une dépense professionnelle (matériel, carburant, cotisations…). */
export interface Expense {
  id: string
  /** AAAA-MM-JJ */
  date: string
  /** Catégorie de dépense (id). */
  cat: string
  /** Montant, en centimes. */
  amount: number
  note?: string
  updatedAt: string
}

export interface Commission {
  enabled: boolean
  /** 'percent' : pourcentage de ta part du mois. 'fixed' : montant fixe par mois (loyer du fauteuil…). */
  mode: 'percent' | 'fixed'
  /** Pourcentage (ex. 20 pour 20 %) ou montant fixe en centimes. */
  value: number
}

export interface Bilan {
  id: string
  /** Mois couvert, AAAA-MM. */
  month: string
  /** Réponse à « As-tu bien gardé tes dépenses perso ? ». */
  expensesKept: boolean
  /** Montant réellement mis de côté, en centimes. */
  actual: number
  /** Réglages au moment du bilan, figés. */
  personalExpenses: number
  commission: Commission
  /** Chiffres figés au moment du bilan : modifier un jour plus tard ne change pas un bilan validé. */
  total?: number
  expected?: number
  createdAt: string
  updatedAt: string
}

export interface Settings {
  /** Prénom affiché sur l'accueil. */
  name: string
  /** Jours travaillés d'habitude : 0 = dimanche … 6 = samedi. */
  workdays: number[]
  /** Heures travaillées par jour (pour le gain par heure). */
  hoursPerDay: number
  /** Part que tu gardes sur ce que tu encaisses, en % (50 = tu gardes la moitié). */
  keepPct: number
  /** Part gardée sur les prestations à domicile, en % (absent : la même qu'au salon). */
  homeKeepPct?: number
  /** Dépenses perso par mois, en centimes. */
  personalExpenses: number
  /** Métier choisi à l'inscription (absent : barbier, la version d'origine de l'app). */
  profession?: { id: string; label: string }
  /** Catégories de recettes et de dépenses du métier (absentes : celles du barbier). */
  incomeCats?: CategoryDef[]
  expenseCats?: CategoryDef[]
  /**
   * Montant déjà coffré, saisi à la main : il remplace le calcul pour tout ce qui précède sa saisie.
   * `month` (AAAA-MM) : mois de la saisie ; `at` (ISO) : moment de la saisie. Ce qui est gagné APRÈS s'ajoute :
   * la fin du mois de la saisie (au prorata), puis chaque mois suivant.
   */
  savedBaseline?: { amount: number; month: string; at?: string }
  /** Objectifs d'épargne (mariage, ski…). */
  goals: Goal[]
  commission: Commission
  /** La présentation du premier lancement a été faite. */
  onboarded: boolean
  updatedAt: string
}

/** Un objectif d'épargne. L'épargne est répartie entre les objectifs par date : le plus proche est rempli en premier. */
export interface Goal {
  id: string
  name: string
  /** Petit symbole affiché à côté du nom. */
  emoji: string
  /** Montant visé, en centimes. */
  amount: number
  /** Date cible, AAAA-MM-JJ. */
  date: string
  createdAt: string
  /** Objectif réalisé : l'argent mis de côté pour lui a été utilisé (il sort de l'épargne). */
  done?: { at: string; spent: number }
}

export const MAX_GOALS = 12

export interface AppData {
  version: 2
  entries: Entry[]
  bilans: Bilan[]
  /** Statut des jours modifiés à la main dans le calendrier. Les autres suivent les jours habituels. */
  days: Record<string, DayStatus>
  /** Suppressions (clé « e:AAAA-MM-JJ » ou « b:AAAA-MM » → date de suppression), pour qu'une fusion ne les fasse pas revenir. */
  deleted: Record<string, string>
  /** Dépenses professionnelles (métiers avec charges). */
  expenses: Expense[]
  settings: Settings
}

export const EPOCH = '1970-01-01T00:00:00.000Z'

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  workdays: [6, 0],
  hoursPerDay: 10,
  keepPct: 50,
  personalExpenses: 30000,
  goals: [],
  commission: { enabled: false, mode: 'percent', value: 0 },
  onboarded: false,
  updatedAt: EPOCH,
}

export const EMPTY_DATA: AppData = {
  version: 2,
  entries: [],
  bilans: [],
  days: {},
  deleted: {},
  expenses: [],
  settings: DEFAULT_SETTINGS,
}

/** Plafonds de bon sens à la saisie. */
export const MAX_DAY_GROSS = 10_000_00 // 10 000 € encaissés en une journée
export const MAX_CLIENTS = 300
export const MIN_DATE = '2000-01-01'
