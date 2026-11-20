import { describe, expect, it } from 'vitest'
import { generateVapidKeys, randomSecret, urlBase64ToBytes } from './vapid'

describe('clés VAPID', () => {
  it('la clé publique fait 65 octets (point P-256 non compressé) et la privée 32 octets', async () => {
    const { publicKey, privateKey } = await generateVapidKeys()
    const pub = urlBase64ToBytes(publicKey)
    expect(pub.length).toBe(65)
    expect(pub[0]).toBe(4)
    expect(urlBase64ToBytes(privateKey).length).toBe(32)
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/) // base64 « URL-safe », sans « = »
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('chaque génération est différente', async () => {
    const a = await generateVapidKeys()
    const b = await generateVapidKeys()
    expect(a.publicKey).not.toBe(b.publicKey)
    expect(a.privateKey).not.toBe(b.privateKey)
  })
  it('secret aléatoire de la bonne longueur, sans caractères ambigus', () => {
    const s = randomSecret(40)
    expect(s).toHaveLength(40)
    expect(s).not.toMatch(/[0OlI1]/)
    expect(randomSecret()).not.toBe(randomSecret())
  })
})
