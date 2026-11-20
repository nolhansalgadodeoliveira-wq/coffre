import { describe, expect, it } from 'vitest'
import { groupThousands, labelIndexes, niceScale, smoothPath } from './charts'

describe('échelle des axes', () => {
  it('choisit des pas ronds', () => {
    expect(niceScale(1721).ticks).toEqual([0, 500, 1000, 1500, 2000])
    expect(niceScale(263).ticks).toEqual([0, 100, 200, 300])
    expect(niceScale(87).ticks).toEqual([0, 50, 100])
    expect(niceScale(8000).ticks).toEqual([0, 2000, 4000, 6000, 8000])
    expect(niceScale(5990).max).toBe(6000)
  })
  it('le maximum de l’axe couvre toujours la plus grande valeur', () => {
    for (let v = 1; v < 200000; v = Math.ceil(v * 1.37)) {
      const s = niceScale(v)
      expect(s.max).toBeGreaterThanOrEqual(v)
      expect(s.ticks.length).toBeLessThanOrEqual(7)
      expect(s.ticks[0]).toBe(0)
      expect(s.ticks.at(-1)).toBe(s.max)
    }
  })
  it('pas entiers pour un nombre de clients, et rien de cassé à 0', () => {
    expect(niceScale(3, 4, true).step).toBe(1)
    expect(niceScale(0).ticks.length).toBeGreaterThan(1)
    expect(niceScale(NaN).max).toBeGreaterThan(0)
  })
})

describe('courbe lissée', () => {
  it('passe par tous les points et ne dépasse jamais', () => {
    const pts: [number, number][] = [[0, 100], [50, 20], [100, 20], [150, 90], [200, 10]]
    const d = smoothPath(pts)
    expect(d.startsWith('M0 100')).toBe(true)
    expect(d.endsWith('200 10')).toBe(true)
    // chaque point de contrôle reste dans l'intervalle vertical des deux points qu'il relie
    const nums = d.match(/C([\d. -]+)/g)!.map((c) => c.slice(1).trim().split(/\s+/).map(Number))
    nums.forEach(([, y1, , y2], i) => {
      const lo = Math.min(pts[i][1], pts[i + 1][1])
      const hi = Math.max(pts[i][1], pts[i + 1][1])
      expect(y1).toBeGreaterThanOrEqual(lo - 1e-6)
      expect(y1).toBeLessThanOrEqual(hi + 1e-6)
      expect(y2).toBeGreaterThanOrEqual(lo - 1e-6)
      expect(y2).toBeLessThanOrEqual(hi + 1e-6)
    })
  })
  it('cas limites : 0, 1, 2 points', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([[5, 6]])).toBe('M5 6')
    expect(smoothPath([[0, 0], [10, 10]])).toBe('M0 0 L10 10')
  })
})

describe('étiquettes', () => {
  it('garde le point le plus récent et espace les autres', () => {
    expect([...labelIndexes(12, 6)].sort((a, b) => a - b)).toEqual([1, 3, 5, 7, 9, 11])
    expect([...labelIndexes(4, 6)]).toEqual([3, 2, 1, 0])
    expect(labelIndexes(0, 6).size).toBe(0)
  })
  it('sépare les milliers', () => {
    expect(groupThousands(12345)).toBe('12 345')
    expect(groupThousands(500)).toBe('500')
  })
})
