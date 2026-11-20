import { describe, expect, it } from 'vitest'
import { setupSql, singleFileFunction } from './remindersSetup'

describe('code de la fonction en un seul fichier', () => {
  const code = singleFileFunction()
  it('contient la logique ET le serveur, avec les imports en tête', () => {
    expect(code.startsWith("import { createClient } from 'npm:@supabase/supabase-js@2'")).toBe(true)
    expect(code).toContain("import webpush from 'npm:web-push@3.6.7'")
    expect(code).toContain('export async function run(')
    expect(code).toContain('Deno.serve(')
    expect(code).toContain('x-cron-secret')
  })
  it('n’importe plus le fichier voisin (il est intégré)', () => {
    expect(code).not.toContain("./logic.ts")
    expect(code.match(/^import /gm)).toHaveLength(2)
  })
})

describe('script SQL', () => {
  const sql = setupSql({ publicKey: 'BPubKey_abc-123', functionUrl: 'https://abcd.supabase.co/functions/v1/reminders', cronSecret: 'Secret42' })
  it('publie la clé, crée les tables protégées et planifie la fonction', () => {
    expect(sql).toContain("('vapid_public', 'BPubKey_abc-123')")
    expect(sql).toContain('enable row level security')
    expect(sql).toContain("cron.schedule('coffre-rappels', '*/15 * * * *'")
    expect(sql).toContain("url     := 'https://abcd.supabase.co/functions/v1/reminders'")
    expect(sql).toContain('"x-cron-secret": "Secret42"')
  })
  it('chaque utilisateur ne voit que ses propres lignes', () => {
    expect(sql.match(/auth\.uid\(\) = user_id/g)!.length).toBeGreaterThanOrEqual(4)
  })
  it('échappe les apostrophes', () => {
    expect(setupSql({ publicKey: "a'b", functionUrl: 'https://x', cronSecret: 's' })).toContain("'a''b'")
  })
})
