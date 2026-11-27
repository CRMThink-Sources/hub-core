import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Mesma abordagem de `routes-insights-permission.test.ts`: `routes.ts` não tem
 * harness de rota, então a fiação é conferida pelo texto. As rotas da aba Envios
 * têm de ficar depois do `thinkzapAccessMiddleware` (quem não tem acesso ao
 * ThinkZap leva 403) e sem `requireThinkzapPermission` (qualquer usuário com
 * acesso vê os próprios envios; o escopo é do caso de uso).
 */
describe('rotas da aba Envios', () => {
  const source = readFileSync(join(__dirname, 'routes.ts'), 'utf8').replace(
    /\s+/g,
    '',
  )
  const middlewareAt = source.indexOf('router.use(thinkzapAccessMiddleware)')

  it.each([
    ['/messages/sends', 'makeListSendsController'],
    ['/messages/sends/:id', 'makeGetSendDetailController'],
  ])(
    'GET %s fica depois do middleware e sem permissão extra',
    (path, factory) => {
      // Sem o ')' final: o Prettier pode deixar uma vírgula antes dele.
      const registration = `router.get('${path}',adaptControllerFactory(${factory})`
      const at = source.indexOf(registration)

      expect(middlewareAt).toBeGreaterThan(-1)
      expect(at).toBeGreaterThan(middlewareAt)
      expect(registration).not.toContain('requireThinkzapPermission')
      expect(registration).not.toContain('requireThinkzapAdmin')
    },
  )
})
