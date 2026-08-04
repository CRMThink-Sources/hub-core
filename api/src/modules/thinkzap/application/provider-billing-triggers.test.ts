import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Quem tem permissão de mexer no ciclo de **cobrança do recurso no provider**.
 *
 * Estes testes não exercitam comportamento: eles travam o conjunto de gatilhos. É
 * a forma de afirmar as duas regras que nenhum teste de caso de uso alcança,
 * porque elas são sobre o código que **não** existe:
 *
 * - Trial expirado nunca desassina — o trial nunca assinou.
 * - Modalidade manual não dispara nada — o ciclo dela é mantido por automação fora
 *   do produto.
 *
 * Se um caminho novo passar a chamar `subscribe`/`unsubscribe`, este teste
 * reprova e obriga a decisão a ser explícita, em vez de virar comportamento
 * incidental.
 */

const THINKZAP_ROOT = join(__dirname, '..')

/** Módulo que expõe as operações; os chamadores é que estão sob escrutínio. */
const BILLING_MODULE = 'provider-resource-billing.ts'

/** Único gatilho autorizado: o handler dos eventos do gateway. */
const AUTHORIZED_CALLERS = new Set([
  'handle-gateway-webhook-event.ts',
  // A ativação chama `subscribe` — e é a mesma cadeia: ela só roda a partir do
  // `checkout.session.completed`.
  'activate-line-subscription.ts',
])

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return collectSourceFiles(full)
    if (extname(entry) !== '.ts' || entry.endsWith('.test.ts')) return []
    return [full]
  })
}

/** Chamadas de valor, com comentários removidos: prosa não conta como gatilho. */
function callsProviderBilling(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  return /providerBilling\.(subscribe|unsubscribe)\(/.test(code)
}

describe('gatilhos do ciclo de cobrança no provider', () => {
  const files = collectSourceFiles(THINKZAP_ROOT).filter(
    file => !file.endsWith(BILLING_MODULE),
  )

  it('só o handler de eventos do gateway dispara subscribe/unsubscribe', () => {
    const callers = files
      .filter(file => callsProviderBilling(readFileSync(file, 'utf8')))
      .map(file => file.split(/[\\/]/).at(-1)!)

    expect(new Set(callers)).toEqual(AUTHORIZED_CALLERS)
  })

  /**
   * Trial expirado continua em `disconnect` e nunca em `unsubscribe`, porque o
   * trial nunca assinou (decisão 4 de `add-connector-trial`). A confusão é fácil
   * de cometer porque os dois métodos vivem no mesmo adapter, e o custo de errar é
   * cancelar a cobrança de um recurso que ninguém estava pagando.
   */
  it('a ativação do trial não toca cobrança no provider', () => {
    const trial = readFileSync(
      join(THINKZAP_ROOT, 'application', 'activate-connector-trial.ts'),
      'utf8',
    )
    const code = trial.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    expect(code).not.toMatch(/\.subscribe\(/)
    expect(code).not.toMatch(/\.unsubscribe\(/)
  })

  /**
   * A modalidade manual não tem gatilho de ciclo de cobrança dentro da aplicação:
   * o estado dela é mantido por automação fora do produto, que escreve direto nas
   * SPAs. Sem esta travação, a aplicação passaria a mexer em cobrança que não é
   * dela — e ninguém aqui saberia o que a automação já fez.
   *
   * Verificado pela negativa: o único gatilho é o handler do gateway, e ele nunca
   * é alcançado por um estado que mudou na SPA sem passar por um evento.
   */
  it('nenhum caminho dispara cobrança a partir de mudança de estado na SPA', () => {
    const handler = readFileSync(
      join(THINKZAP_ROOT, 'application', 'handle-gateway-webhook-event.ts'),
      'utf8',
    )

    // O handler recebe `GatewayEvent` e nada mais: não há entrada por assinatura
    // lida da SPA, então não existe caminho que observe a modalidade manual mudar.
    expect(handler).toMatch(/execute\(event: GatewayEvent\)/)
    expect(handler).not.toMatch(/modality/)
  })
})
