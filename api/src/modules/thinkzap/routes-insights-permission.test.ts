import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `routes.ts` monta dezenas de controllers reais e não tem harness de rota;
 * por isso a fiação é conferida pelo texto. O comportamento do guard em si
 * (403 para quem só tem finance/thinkbot, passe livre para admin) é coberto em
 * `thinkzap-access.middleware.test.ts`. Aqui só se garante que as leituras do
 * Insights usam o mesmo gate (`connectors.read`) que o front.
 */
describe('rotas GET do Insights', () => {
  // Espaços e quebras colapsados: a formatação não pode quebrar o teste.
  const source = readFileSync(join(__dirname, 'routes.ts'), 'utf8').replace(
    /[ \t\r\n]+/g,
    ' ',
  )

  it.each(['status', 'dashboard', 'today', 'config'])(
    'GET /insights/%s exige connectors.read',
    name => {
      expect(source).toContain(
        `router.get( '/insights/${name}', requireThinkzapPermission('connectors', 'read'),`,
      )
    },
  )
})
