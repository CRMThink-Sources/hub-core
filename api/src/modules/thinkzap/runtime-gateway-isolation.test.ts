import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O gateway de pagamento **não** existe no caminho quente.
 *
 * O runtime lê a SPA para decidir se a linha funciona. Consultar o gateway ali
 * colocaria a latência e o rate limit de um terceiro em cada mensagem recebida, e
 * uma indisponibilidade deles derrubaria o envio de **todos** os clientes —
 * inclusive dos que pagam por boleto e não têm relação nenhuma com o gateway.
 *
 * Verificado pelo grafo de imports, não por inspeção de chamada: é a única forma
 * de afirmar que nenhum caminho *transitivo* alcança o gateway. Um `import` novo
 * três módulos abaixo reprova aqui, que é exatamente quando isso precisa ser
 * notado — e não em produção, sob carga.
 */

const SRC_ROOT = resolve(__dirname, '..', '..')

/** Módulos que fazem o trabalho quente: mensagem entrando, saindo, e a decisão. */
const RUNTIME_ENTRYPOINTS = [
  'modules/thinkzap/application/process-z-api-inbound-message.use-case.ts',
  'modules/thinkzap/application/process-hubmessage-inbound-message.use-case.ts',
  'modules/thinkzap/application/send-widget-message.use-case.ts',
  'modules/thinkzap/application/list-lines-for-widget.ts',
  'modules/thinkzap/application/get-line-subscription-state.ts',
  'modules/thinkzap/domain/connector-trial.ts',
  'workers/bitrix-received-message.processor.ts',
]

/** O que nenhum deles pode alcançar, direta ou transitivamente. */
const FORBIDDEN_MODULES = [
  'modules/thinkzap/infra/gateway/stripe-payment.gateway.ts',
  'modules/thinkzap/application/handle-gateway-webhook-event.ts',
  'modules/thinkzap/application/activate-line-subscription.ts',
  'modules/thinkzap/application/create-subscription-checkout.ts',
  'modules/thinkzap/application/create-billing-portal-session.ts',
]

const IMPORT_PATTERN =
  /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g

/** Resolve o especificador para um arquivo em `src`, ou `null` se é externo. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : null

  // Pacote de node_modules: nada a percorrer.
  if (!base) return null

  // `.js` nos imports internos é o sufixo de ESM: o arquivo real é `.ts`.
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    `${base}.ts`,
    join(base, 'index.ts'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }

  return null
}

/** Todos os módulos de `src` alcançáveis a partir de um arquivo. */
function collectReachable(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const current = queue.pop()!
    if (seen.has(current)) continue
    seen.add(current)

    const source = readFileSync(current, 'utf8')

    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const resolved = resolveSpecifier(current, match[1]!)
      if (resolved && !seen.has(resolved)) queue.push(resolved)
    }
  }

  return seen
}

describe('isolamento do gateway de pagamento no runtime', () => {
  it.each(RUNTIME_ENTRYPOINTS)(
    '%s não alcança o gateway por nenhum caminho de import',
    entry => {
      const entryPath = join(SRC_ROOT, entry)
      expect(existsSync(entryPath)).toBe(true)

      const reachable = collectReachable(entryPath)

      const violations = FORBIDDEN_MODULES.map(module =>
        join(SRC_ROOT, module),
      ).filter(module => reachable.has(module))

      expect(violations).toEqual([])
    },
  )

  /**
   * A face crua da mesma regra: no código que serve requisição, o pacote do gateway
   * é importado em **um** arquivo — o adapter. Qualquer segundo lugar é uma decisão
   * que precisa ser discutida, não um import a mais.
   *
   * `src/scripts/` fica fora: são diagnósticos rodados à mão no terminal, só leitura,
   * e nenhum deles é alcançável de uma rota ou de um worker. Excluí-los é o que
   * mantém a asserção sobre o que ela quer dizer — "o caminho quente não fala com o
   * gateway" — em vez de virar uma lista de exceções que cresce até não afirmar nada.
   */
  it('o pacote do gateway é importado só pelo adapter, fora de scripts', () => {
    const importers = collectSourceFiles(SRC_ROOT)
      .filter(file => !file.endsWith('.test.ts'))
      .filter(file => !file.includes(`${SRC_ROOT}${sep}scripts${sep}`))
      .filter(file => /from ['"]stripe['"]/.test(readFileSync(file, 'utf8')))
      .map(file => file.slice(SRC_ROOT.length + 1).replace(/\\/g, '/'))

    expect(importers).toEqual([
      'modules/thinkzap/infra/gateway/stripe-payment.gateway.ts',
    ])
  })

  /**
   * E os scripts continuam fora do grafo do runtime: se um deles for importado por
   * código de rota ou worker, o `stripe` entra pela porta de trás e a asserção acima
   * passa a ser contornável.
   */
  it('nenhum módulo de runtime importa um script', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter(file => !file.endsWith('.test.ts'))
      .filter(file => !file.includes(`${SRC_ROOT}${sep}scripts${sep}`))
      .filter(file =>
        /from ['"][^'"]*scripts\//.test(readFileSync(file, 'utf8')),
      )
      .map(file => file.slice(SRC_ROOT.length + 1).replace(/\\/g, '/'))

    expect(offenders).toEqual([])
  })

  /**
   * O entitlement decide por `status` e janela, sobre dado que veio da SPA. Se ele
   * mencionasse o gateway, a decisão que roda por mensagem passaria a depender de
   * um terceiro.
   */
  it('o entitlement não menciona o gateway', () => {
    const source = readFileSync(
      join(SRC_ROOT, 'modules/thinkzap/domain/connector-trial.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/stripe/i)
    expect(source).not.toMatch(/gateway/i)
  })
})

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' || entry.name === 'generated'
        ? []
        : collectSourceFiles(full)
    }
    return entry.name.endsWith('.ts') ? [full] : []
  })
}
