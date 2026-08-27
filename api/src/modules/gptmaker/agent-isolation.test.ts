import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O acesso ao vendor por agente passa **sempre** por `forAgent`.
 *
 * Todos os agentes de todos os clientes vivem no mesmo workspace do GPT Maker,
 * e a API do vendor aceita qualquer `agentId` venha de quem vier. A única coisa
 * que separa um cliente do outro é `core_gpt_agents`.
 *
 * Um controller com o client cru em mãos pode chamar `updateAgent(id)` ou
 * `deleteAgent(id)` com o id que chegou na URL, sem provar posse — e aí o
 * cliente A altera e apaga o agente do cliente B trocando um id. São oito rotas
 * com `:agentId` só nesta fatia; uma que esqueça a checagem abre o buraco.
 *
 * **Por que não alcançabilidade transitiva.** O teste equivalente do thinkzap
 * (`runtime-gateway-isolation.test.ts`) percorre o grafo de imports porque lá o
 * módulo proibido nunca é necessário no caminho quente. Aqui é diferente: o
 * client cru é justamente o que `forAgent` usa, então todo caminho que passa
 * pela porta certa também "alcança" o client. Alcançar não é o problema —
 * **obter uma instância** é. Por isso o guardrail é sobre quem importa o client
 * e sobre o que o módulo de composição expõe.
 */

const SRC_ROOT = resolve(__dirname, '..', '..')
const MODULE_ROOT = resolve(__dirname)

const DEPS_MODULE = join(MODULE_ROOT, 'main', 'make-gptmaker-deps.ts')

/**
 * Os únicos módulos que podem obter uma instância do client cru.
 *
 * `scoped-agent.client.ts` é a porta (`forAgent`). `make-gptmaker-deps.ts` é
 * quem a constrói e a mantém privada. Imports `type`-only ficam de fora: um
 * tipo é apagado na compilação e não dá para chamar nada com ele.
 */
const ALLOWED_RAW_CLIENT_IMPORTERS = [
  'modules/gptmaker/infra/clients/scoped-agent.client.ts',
  'modules/gptmaker/main/make-gptmaker-deps.ts',
]

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(full)
    return entry.name.endsWith('.ts') ? [full] : []
  })
}

function relativeToSrc(file: string): string {
  return file
    .slice(SRC_ROOT.length + 1)
    .split(sep)
    .join('/')
}

/**
 * Importa o client cru de forma que renda uma instância (não `import type`).
 *
 * O corpo do import é `(?:(?!\bimport\b)[\s\S])*?` e não `[\s\S]*?` porque o
 * segundo permite backtracking através de outros statements: um
 * `import { algo } from './outro'` seguido mais abaixo de um
 * `import type { Client } from './gptmaker.client'` casaria como se fosse um
 * import de valor do client, e o teste acusaria arquivo limpo.
 */
function importsRawClientAtRuntime(file: string): boolean {
  const source = readFileSync(file, 'utf8')

  return /(?:^|\n)\s*import\s+(?!type\s)(?:(?!\bimport\b)[\s\S])*?from\s+['"][^'"]*gptmaker\.client(?:\.js)?['"]/.test(
    source,
  )
}

const CONTROLLERS = collectSourceFiles(
  join(MODULE_ROOT, 'presentation', 'controllers'),
).filter(file => !file.endsWith('.test.ts'))

describe('isolamento entre instalações no gptmaker', () => {
  it('existe pelo menos um controller para verificar', () => {
    // Sem esta asserção, apagar a pasta de controllers faria os `it.each`
    // abaixo rodarem zero casos e o teste "passar" sem verificar nada.
    expect(CONTROLLERS.length).toBeGreaterThan(0)
  })

  it('o client cru só é instanciável pelos módulos autorizados', () => {
    const importers = collectSourceFiles(MODULE_ROOT)
      .filter(file => !file.endsWith('.test.ts'))
      .filter(importsRawClientAtRuntime)
      .map(relativeToSrc)
      .sort()

    expect(importers).toEqual([...ALLOWED_RAW_CLIENT_IMPORTERS].sort())
  })

  /**
   * O módulo de composição é o que os controllers importam. Se ele exportar a
   * instância do client, a lista acima continua curta e o buraco existe do
   * mesmo jeito — o controller pega o client por ali.
   */
  it('o módulo de composição não expõe a instância do client', () => {
    const source = readFileSync(DEPS_MODULE, 'utf8')

    const exportedClient =
      /export\s+(?:const|let|var)\s+\w*[cC]lient\b/.test(source) ||
      /export\s*\{[^}]*\bclient\b[^}]*\}/.test(source)

    expect(exportedClient).toBe(false)
  })

  it.each(CONTROLLERS.map(relativeToSrc))(
    '%s não importa o client cru',
    relative => {
      expect(importsRawClientAtRuntime(join(SRC_ROOT, relative))).toBe(false)
    },
  )

  /**
   * Toda rota com `:agentId` recebe o id do cliente. O controller que o lê sem
   * passar por `scopeTo` está falando com o vendor sobre um agente cuja posse
   * ninguém conferiu.
   */
  it.each(CONTROLLERS.map(relativeToSrc))(
    '%s resolve a posse antes de usar params.agentId',
    relative => {
      const source = readFileSync(join(SRC_ROOT, relative), 'utf8')

      if (!/params\.agentId/.test(source)) return

      expect(source).toMatch(/\bscopeTo\(/)
    },
  )

  /**
   * `findOwned` é o que escopa a leitura por instalação. As buscas sem escopo
   * existem para a reconciliação, que precisa varrer o workspace inteiro — em
   * qualquer outro lugar elas devolvem o agente de qualquer cliente.
   */
  it('a busca sem escopo de instalação só é usada pela reconciliação', () => {
    const users = collectSourceFiles(MODULE_ROOT)
      .filter(file => !file.endsWith('.test.ts'))
      .filter(file => !file.includes(`domain${sep}repositories`))
      .filter(file =>
        /\bfindByGptMakerAgentId\b|\blistAll\b/.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map(relativeToSrc)
      .sort()

    expect(users).toEqual([
      'modules/gptmaker/application/reconcile-agents.ts',
      'modules/gptmaker/infra/persistence/repositories/prisma-agent.repository.ts',
    ])
  })
})
