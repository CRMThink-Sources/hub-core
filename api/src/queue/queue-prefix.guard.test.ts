import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bullBaseOptions } from './redis-connection'

const SRC = join(__dirname, '..')

/** Construções do BullMQ que precisam concordar em conexão e prefixo. */
const CONSTRUCTION =
  /new\s+(Queue|Worker|QueueEvents|FlowProducer)\s*(<[^(]*>)?\s*\(/g

/**
 * Onde a opção nasce — é o único arquivo que pode falar `connection:` direto.
 */
const SOURCE_OF_TRUTH = 'queue/redis-connection.ts'

/**
 * O texto entre o `(` da chamada e o `)` que o fecha.
 *
 * Contagem de parênteses simples, sem entender string nem comentário: um `(` dentro de
 * literal desequilibraria a conta. Nenhuma construção de fila tem isso, e o desfecho de
 * um desequilíbrio é o teste reclamar de um arquivo legítimo — falha visível, não
 * silenciosa.
 */
function callArguments(content: string, openParenIndex: number): string {
  let depth = 0

  for (let index = openParenIndex; index < content.length; index += 1) {
    if (content[index] === '(') depth += 1
    if (content[index] === ')') {
      depth -= 1
      if (depth === 0) return content.slice(openParenIndex, index + 1)
    }
  }

  return content.slice(openParenIndex)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) return sourceFiles(path)
    if (!entry.name.endsWith('.ts')) return []
    if (entry.name.includes('.test.')) return []

    return [path]
  })
}

/**
 * Guarda de ambiente, não de estilo.
 *
 * `Queue` e `Worker` que discordem do prefixo não dão erro: dão worker ouvindo fila
 * vazia enquanto o produtor escreve noutra, e a mensagem some sem log. Staging e
 * produção no mesmo Redis sem prefixo dão o inverso — o worker do ambiente errado
 * consome a mensagem do cliente e a derruba contra o banco errado. Foi o que
 * aconteceu, e é o que este teste existe para não deixar acontecer de novo.
 */
describe('prefixo das filas', () => {
  it('sai do ambiente', () => {
    expect(bullBaseOptions.prefix).toBe(process.env.QUEUE_PREFIX ?? 'bull')
  })

  /**
   * Delimita a chamada casando parênteses, em vez de olhar uma janela de tamanho fixo:
   * worker com callback inline longo põe a lista de opções centenas de linhas depois do
   * `new Worker(`, e uma janela grande o bastante para alcançá-la passaria a casar o
   * `bullBaseOptions` da construção vizinha.
   */
  it('toda construção de Queue/Worker é servida por bullBaseOptions', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(SRC)) {
      const relativePath = relative(SRC, file).replace(/\\/g, '/')
      if (relativePath === SOURCE_OF_TRUTH) continue

      const content = readFileSync(file, 'utf8')

      for (const match of content.matchAll(CONSTRUCTION)) {
        const call = callArguments(content, match.index + match[0].length - 1)

        /**
         * O objeto tem de entrar inteiro — como argumento ou espalhado. Acesso a
         * propriedade (`bullBaseOptions.connection`) **não** conta: é o descuido que
         * reintroduz o bug, porque leva a conexão e deixa o prefixo atrás.
         */
        if (!/\bbullBaseOptions\b(?!\s*\.)/.test(call)) {
          offenders.push(`${relativePath} → new ${match[1]}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('só a fonte da verdade passa a conexão crua', () => {
    const rawConnection = sourceFiles(SRC).filter(file => {
      const relativePath = relative(SRC, file).replace(/\\/g, '/')
      if (relativePath === SOURCE_OF_TRUTH) return false

      return readFileSync(file, 'utf8').includes('connection: redisConnection')
    })

    expect(rawConnection).toEqual([])
  })
})
