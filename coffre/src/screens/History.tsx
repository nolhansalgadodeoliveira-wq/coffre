import { useState } from 'react'
import type { ScreenProps } from '../App'
import { entriesOfMonth, monthsWithData, plural, savedBilanFigures, sum } from '../lib/calc'
import { formatMonthKey, weekday, WEEKDAY_SHORT } from '../lib/dates'
import { formatEuros, formatEurosShort, formatSigned } from '../lib/money'
import { ArrowBadge, Card, Chip, DeltaChip, Screen, Segmented, type Tone } from '../ui'

const DAY_TONES = ['bg-pink', 'bg-blue', 'bg-blue', 'bg-blue', 'bg-blue', 'bg-blue', 'bg-orange'] // dimanche, semaine, samedi
const CARD_TONES: Tone[] = ['orange', 'blue', 'pink', 'violet']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function History({ data, open }: ScreenProps) {
  const [view, setView] = useState<'jours' | 'bilans'>('jours')
  const months = monthsWithData(data).reverse()
  const bilans = data.bilans.map((b) => ({ b, f: savedBilanFigures(b, data) })).sort((x, y) => y.b.month.localeCompare(x.b.month))
  const billed = new Set(data.bilans.map((b) => b.month))

  return (
    <Screen title="Historique">
      <Segmented
        label="Afficher"
        value={view}
        onChange={setView}
        options={[
          { value: 'jours', label: `Journées · ${data.entries.length}` },
          { value: 'bilans', label: `Bilans · ${bilans.length}` },
        ]}
      />

      {view === 'jours' &&
        (months.length === 0 ? (
          <Card className="text-[1rem] text-muted">Aucune journée saisie pour l'instant.</Card>
        ) : (
          months.map((m) => {
            const es = entriesOfMonth(data, m).reverse()
            return (
              <section key={m} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-[1.1875rem] font-semibold">{cap(formatMonthKey(m))}</h2>
                  <span className="num text-[0.9375rem] text-muted">
                    {formatEurosShort(sum(es))} · {billed.has(m) ? 'bilan fait' : plural(es.length, 'jour', 'jours')}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {es.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => open({ kind: 'ajout', entryId: e.id })} className="flex w-full items-center gap-4 rounded-[22px] bg-surface p-3 pr-5 text-left active:scale-[0.99]">
                        <span className={`flex h-13 w-13 shrink-0 flex-col items-center justify-center rounded-[16px] ${DAY_TONES[weekday(e.date)]}`}>
                          <span className="text-[0.6875rem] font-medium">{WEEKDAY_SHORT[weekday(e.date)]}</span>
                          <span className="num text-[1.1875rem] leading-none font-semibold">{Number(e.date.slice(8))}</span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[1rem] font-medium">Encaissé {formatEurosShort(e.gross)}</span>
                          {e.clients != null && <span className="text-[0.8125rem] text-muted">{plural(e.clients, 'client', 'clients')}</span>}
                        </span>
                        <span className="num shrink-0 text-[1.0625rem] font-semibold">{formatEuros(e.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        ))}

      {view === 'bilans' &&
        (bilans.length === 0 ? (
          <Card className="text-[1rem] text-muted">Ton premier bilan arrivera à la fin de ton premier mois.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {bilans.map(({ b, f }, i) => (
              <button key={b.id} type="button" onClick={() => open({ kind: 'bilan', bilanId: b.id })} className="text-left active:scale-[0.99]">
                <Card tone={CARD_TONES[i % CARD_TONES.length]} className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Chip>{f.gap > 0 ? 'En avance' : f.gap < 0 ? 'En retard' : 'Dans le plan'}</Chip>
                    <DeltaChip value={f.gap}>{formatSigned(f.gap)}</DeltaChip>
                  </div>
                  <span className="display text-[1.75rem]">{cap(formatMonthKey(b.month))}</span>
                  <div className="flex items-end justify-between gap-3">
                    <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 text-[0.8125rem]">
                      <Stat label="Ta part" value={formatEurosShort(f.total)} />
                      <Stat label="Attendu" value={formatEurosShort(f.expected)} />
                      <Stat label="De côté" value={formatEurosShort(b.actual)} />
                    </div>
                    <ArrowBadge />
                  </div>
                  {f.changed && <span className="rounded-2xl bg-white/70 px-3 py-2 text-[0.8125rem]">Des journées ont changé depuis ce bilan. Touche pour le mettre à jour.</span>}
                  {!b.expensesKept && <span className="text-[0.8125rem] text-ink/80">Dépenses perso dépassées ce mois-là</span>}
                </Card>
              </button>
            ))}
            <p className="px-1 text-[0.875rem] text-muted">Supprimer un bilan remet son mois en cours.</p>
          </div>
        ))}
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-ink/80">{label}</span>
      <span className="num text-[1rem] font-semibold">{value}</span>
    </div>
  )
}
