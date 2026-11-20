import { describe, expect, it } from 'vitest'
import { emojiFor, emojiSearch } from './goals'

const bare = (e: string) => e.replace(/️/g, '')
const is = (name: string, emoji: string) => expect(bare(emojiFor(name))).toBe(bare(emoji))

describe('symbole automatique d’un objectif (comme la recherche d’emoji de l’iPhone)', () => {
  it('d’après le nom', () => {
    is('Moto', '🏍️')
    is('Mariage', '💍')
    is('Ski', '⛷️')
    is('Voiture', '🚗')
    is('Pizza', '🍕')
    is('Guitare', '🎸')
    is('Japon', '🇯🇵')
    is('Chien', '🐕')
    is('Camping', '🏕️')
  })
  it('sans tenir compte des accents, majuscules, pluriels, petits mots', () => {
    is('ma future MOTO', '🏍️')
    is('motos', '🏍️')
    is('Bébé', '👶')
    is('Noël', '🎄')
    is('Nouvel iPhone', '📱')
    is('Matériel barber', '💈')
  })
  it('malgré une faute de frappe', () => {
    is('Voitrue', '🚗')
    is('Guitarre', '🎸')
  })
  it('expressions de plusieurs mots', () => {
    is('Lune de miel', '💑')
    is('Épargne coup dur', '🛟')
  })
  it('propose d’autres emojis proches', () => {
    expect(emojiSearch('Ski', 5).length).toBeGreaterThan(2)
    expect(emojiSearch('Ski', 5).map(bare)).toContain(bare('🎿'))
  })
  it('🎯 quand rien ne ressemble', () => {
    expect(emojiFor('')).toBe('🎯')
    expect(emojiFor('Xqzw')).toBe('🎯')
  })
})
