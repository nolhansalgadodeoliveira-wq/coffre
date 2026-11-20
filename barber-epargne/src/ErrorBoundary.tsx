import { dataKey } from './lib/storage'
import { Component, type ReactNode } from 'react'

/**
 * Filet de sécurité : si un écran plante, on affiche un message et un moyen de sauver ses données,
 * au lieu d'une page blanche.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  exportRaw = () => {
    try {
      const raw = localStorage.getItem(dataKey()) ?? '{}'
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'coffre-secours.json'
      a.click()
    } catch {
      /* rien à exporter */
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
        <h1 className="display text-[2rem]">Oups, un écran a planté.</h1>
        <p className="text-[1rem] text-muted">Tes données ne sont pas perdues. Recharge l’app ; si le problème revient, télécharge une copie de tes données.</p>
        <button type="button" onClick={() => location.reload()} className="h-14 rounded-full bg-ink text-[1.0625rem] font-semibold text-white">
          Recharger l’app
        </button>
        <button type="button" onClick={this.exportRaw} className="h-14 rounded-full bg-surface text-[1rem] font-medium">
          Télécharger mes données
        </button>
        <p className="text-[0.8125rem] text-muted">Détail : {this.state.error.message}</p>
      </div>
    )
  }
}
