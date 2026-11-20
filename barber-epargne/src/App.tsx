import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppData } from './lib/types'
import { download, loadData, markComplimentSeen, recoveredBroken, saveData, seenCompliments } from './lib/storage'
import { currentAccount, type Account } from './lib/accounts'
import { useSync, type Sync } from './lib/useSync'
import { nextCompliment, type Compliment } from './lib/compliments'
import { monthKeyOf, todayIso } from './lib/dates'
import { IconCalendar, IconChart, IconHome, IconList, IconUser } from './icons'
import Welcome from './screens/Welcome'
import Logo from './Logo'
import Onboarding from './screens/Onboarding'
import { pendingDays } from './lib/calc'
import { snapshot } from './lib/backup'
import { loadPrefs, setBadge } from './lib/push'
import Home from './screens/Home'
import AddDay from './screens/AddDay'
import BilanScreen from './screens/BilanScreen'
import Calendar from './screens/Calendar'
import History from './screens/History'
import SettingsScreen from './screens/SettingsScreen'
import StatsScreen from './screens/StatsScreen'
import { GoalEditScreen, GoalsScreen } from './screens/GoalsScreen'

export type Tab = 'accueil' | 'calendrier' | 'stats' | 'historique' | 'reglages'
export type Overlay =
  | { kind: 'ajout'; entryId?: string; month?: string; date?: string }
  /** Bilan d'un mois (AAAA-MM) à faire, ou bilan existant à modifier. */
  | { kind: 'bilan'; month?: string; bilanId?: string }
  /** Liste des objectifs, et ajout / modification d'un objectif. */
  | { kind: 'objectifs' }
  | { kind: 'objectif'; goalId?: string; fromList?: boolean }
  /** Revoir la présentation du premier lancement. */
  | { kind: 'presentation' }
  | null
export type Update = (fn: (d: AppData) => AppData) => void

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'accueil', label: 'Accueil', icon: <IconHome /> },
  { id: 'calendrier', label: 'Calendrier', icon: <IconCalendar /> },
  { id: 'stats', label: 'Stats', icon: <IconChart /> },
  { id: 'historique', label: 'Historique', icon: <IconList /> },
  { id: 'reglages', label: 'Réglages', icon: <IconUser /> },
]

const gutter = { paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }

export default function App() {
  // Compte connecté (mémorisé sur l'appareil). Sans compte : écran de connexion, aucune donnée chargée.
  const [account] = useState<Account | null>(currentAccount)
  if (!account) return <Welcome />
  return <Main account={account} />
}

function Main({ account }: { account: Account }) {
  const [data, setData] = useState<AppData>(loadData)
  const [broken, setBroken] = useState(recoveredBroken)
  const [tab, setTab] = useState<Tab>('accueil')
  const [overlay, setOverlayState] = useState<Overlay>(null)
  const overlayRef = useRef<Overlay>(null)
  overlayRef.current = overlay
  const [saveFailed, setSaveFailed] = useState(false)
  const today = todayIso()
  // Mois affiché sur l'accueil : mémorisé pour ne pas revenir au mois en cours après chaque ajout.
  const [homeMonth, setHomeMonth] = useState(monthKeyOf(today))
  // Compliment choisi UNE fois au lancement de l'app (ce qui s'est passé depuis la dernière ouverture).
  const [compliment, setCompliment] = useState<Compliment | null>(() => nextCompliment(data, todayIso(), seenCompliments()))
  useEffect(() => {
    if (compliment) markComplimentSeen(compliment.key)
  }, [compliment])

  useEffect(() => {
    snapshot(data, todayIso())
  }, [data])
  // Copie en ligne du compte : retrouvée sur n'importe quel appareil.
  const sync = useSync(account, data, setData)

  useEffect(() => {
    setSaveFailed(!saveData(data))
  }, [data])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, overlay])

  // Ouvre la saisie de la journée : touche d'une notification (#saisir) ou message du service worker.
  const openAddToday = useCallback(() => {
    setTab('accueil')
    open({ kind: 'ajout', date: todayIso() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const readyForAdd = data.settings.onboarded
  useEffect(() => {
    if (!readyForAdd) return
    if (window.location.hash === '#saisir') {
      history.replaceState(null, '', window.location.pathname + window.location.search)
      openAddToday()
    }
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'open-add') openAddToday()
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [readyForAdd, openAddToday])

  // Saisie rapide : en ouvrant l'app après l'heure du rappel, un jour de travail pas encore saisi,
  // on arrive directement sur la saisie de la journée (une fois par jour).
  useEffect(() => {
    if (!data.settings.onboarded) return
    const t = todayIso()
    const now = new Date()
    const [h, m] = loadPrefs().time.split(':').map(Number)
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
    if (!pendingDays(data, t, 0).includes(t)) return
    try {
      if (localStorage.getItem('coffre-saisie-auto:v1') === t) return
      localStorage.setItem('coffre-saisie-auto:v1', t)
    } catch {
      return
    }
    open({ kind: 'ajout', date: t })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pastille sur l'icône : nombre de jours prévus à saisir (les 3 derniers jours).
  useEffect(() => {
    const refresh = () => {
      const t = todayIso()
      const now = new Date()
      const [h, m] = loadPrefs().time.split(':').map(Number)
      const afterReminder = now.getHours() * 60 + now.getMinutes() >= h * 60 + m
      setBadge(pendingDays(data, t, 2).filter((d) => d < t || afterReminder).length)
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [data])

  // Geste « retour » du téléphone : il ferme l'écran ouvert au lieu de quitter l'app.
  useEffect(() => {
    const onPop = () => setOverlayState(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((o: Overlay) => {
    if (o === null) return
    if (overlayRef.current) history.replaceState({ coffre: 1 }, '')
    else history.pushState({ coffre: 1 }, '')
    setOverlayState(o)
  }, [])
  const close = useCallback(() => {
    if ((history.state as { coffre?: number } | null)?.coffre) history.back()
    else setOverlayState(null)
  }, [])

  const update: Update = useCallback((fn) => setData((d) => fn(d)), [])
  const props: ScreenProps = { data, update, today, open, close, homeMonth, setHomeMonth, account, sync, goTab: setTab, compliment, dismissCompliment: () => setCompliment(null) }

  // Nouvel appareil : on récupère d'abord les données du compte (quelques secondes au plus).
  if (sync.firstPull && data.entries.length === 0 && !data.settings.onboarded) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-muted">
        <Logo size={56} />
        <span className="text-[0.9375rem]">Récupération de tes données…</span>
      </div>
    )
  }

  // Présentation : prénom, jours travaillés, part gardée, objectif.
  if (!data.settings.onboarded || overlay?.kind === 'presentation') {
    return <Onboarding data={data} update={update} replay={overlay?.kind === 'presentation'} done={() => (overlay ? close() : undefined)} />
  }

  let content
  if (overlay?.kind === 'ajout') content = <AddDay {...props} entryId={overlay.entryId} month={overlay.month} date={overlay.date} />
  else if (overlay?.kind === 'objectifs') content = <GoalsScreen {...props} />
  else if (overlay?.kind === 'objectif') content = <GoalEditScreen {...props} goalId={overlay.goalId} fromList={overlay.fromList} />
  else if (overlay?.kind === 'bilan') content = <BilanScreen {...props} month={overlay.month} bilanId={overlay.bilanId} />
  else if (tab === 'accueil') content = <Home {...props} />
  else if (tab === 'calendrier') content = <Calendar {...props} />
  else if (tab === 'stats') content = <StatsScreen {...props} />
  else if (tab === 'historique') content = <History {...props} />
  else content = <SettingsScreen {...props} />

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 pt-[max(20px,env(safe-area-inset-top))] pb-36" style={gutter}>
        {saveFailed && (
          <p className="mb-4 rounded-2xl bg-bad-soft p-4 text-[0.9375rem] text-bad" role="alert">
            Cet appareil refuse l'enregistrement (navigation privée ou stockage plein). Exporte tes données depuis Réglages pour ne rien perdre.
          </p>
        )}
        {broken && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-orange-soft p-4 text-[0.9375rem]" role="alert">
            <span>Des données illisibles ont été trouvées sur ce téléphone. Elles ont été mises de côté, rien n’est perdu.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => download('coffre-donnees-abimees.json', broken.raw, 'application/json')} className="h-11 rounded-full bg-ink px-4 font-semibold text-white">
                Télécharger la copie
              </button>
              <button type="button" onClick={() => setBroken(null)} className="h-11 rounded-full px-4">
                Fermer
              </button>
            </div>
          </div>
        )}
        {content}
      </main>

      {!overlay && (
        // Barre noire flottante : l'onglet actif est une pastille blanche.
        <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-10" style={{ ...gutter, paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-1 rounded-full bg-ink p-2 shadow-[0_12px_30px_-12px_rgba(18,18,21,0.55)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id)
                  if (t.id === 'accueil') setHomeMonth(monthKeyOf(today))
                }}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${tab === t.id ? 'bg-white text-ink' : 'text-white/80 active:text-white'}`}
              >
                <span className="[&>svg]:h-5 [&>svg]:w-5">{t.icon}</span>
                <span className="text-[0.625rem] leading-none font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export interface ScreenProps {
  data: AppData
  update: Update
  today: string
  open: (o: Overlay) => void
  close: () => void
  homeMonth: string
  setHomeMonth: (m: string) => void
  account: Account
  sync: Sync
  goTab: (t: Tab) => void
  compliment?: Compliment | null
  dismissCompliment?: () => void
}

export const nowIso = () => new Date().toISOString()
