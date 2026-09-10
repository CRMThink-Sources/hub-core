import 'dotenv/config'
import { prisma } from '@/config/prisma'
import {
  advance,
  collapseSays,
} from '@/modules/thinkzap/domain/bot-flow/advance'
import { exampleFlow } from '@/modules/thinkzap/domain/bot-flow/example-flow'
import { validateFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import { EMPTY_GRAPH } from '@/modules/thinkzap/domain/bot-flow/empty-flow'
import { PrismaBotFlowRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow.repository'
import { PrismaBotFlowBindingRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-binding.repository'

/**
 * Prova de que a camada de dados dos fluxos fecha contra o banco real: grava, lê,
 * publica, vincula e roda o motor sobre o que voltou do MySQL.
 *
 * Roda contra o app instalado que já existe no banco de dev. Limpa o que criou.
 */
async function main() {
  const app = await prisma.app.findFirst({
    select: { id: true, domainId: true },
  })
  if (!app) {
    console.log('sem app instalado no banco — nada a fazer')
    return
  }
  console.log('app:', app.id, 'domain', app.domainId)

  const flows = new PrismaBotFlowRepository()
  const bindings = new PrismaBotFlowBindingRepository()
  const name = `smoke-${Date.now()}`

  const criada = await flows.create({ appId: app.id, name, graph: EMPTY_GRAPH })
  console.log('criada:', criada.id, criada.status, 'v' + criada.version)

  // Grafo real no lugar do vazio, para exercitar o Json do MySQL com nó de todo tipo.
  const salva = await flows.update(app.id, criada.id, { graph: exampleFlow })
  console.log('nós gravados:', salva.graph.nodes.length)
  console.log('problemas de validação:', validateFlowGraph(salva.graph).length)

  const lida = await flows.getById(app.id, criada.id)
  /**
   * Comparação insensível à ordem das chaves: o `zod` remonta o objeto na ordem do
   * schema, então `JSON.stringify` difere sem que nenhum dado tenha mudado.
   */
  const norm = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(norm)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, val]) => [key, norm(val)]),
          )
        : value
  console.log(
    'round-trip do graph bate:',
    JSON.stringify(norm(lida?.graph)) === JSON.stringify(norm(exampleFlow)),
  )

  // Posição do canvas: se não persistir, arrastar bloco e recarregar perde o layout.
  const movida = await flows.update(app.id, criada.id, {
    graph: {
      ...exampleFlow,
      nodes: exampleFlow.nodes.map((node, index) => ({
        ...node,
        position: { x: index * 400, y: index * 90 },
      })),
    },
  })
  const n3 = movida.graph.nodes.find(node => node.id === 'n3')
  console.log('position sobreviveu ao banco:', JSON.stringify(n3?.position))

  const publicada = await flows.publish(app.id, criada.id)
  console.log('publicada:', publicada.status, 'v' + publicada.version)

  const vinculo = await bindings.create({
    appId: app.id,
    flowId: criada.id,
    lineId: '99',
    priority: 10,
    active: true,
    condition: null,
  })
  console.log('vínculo:', vinculo.id, 'linha', vinculo.lineId)

  const listados = await bindings.listByAppId(app.id)
  console.log(
    'vínculo lido com nome do fluxo:',
    listados.find(b => b.id === vinculo.id)?.flowName,
  )

  // Motor sobre o grafo que voltou do banco: é o caminho que o worker fará.
  const graph = lida?.graph ?? exampleFlow
  const abertura = advance(graph, null, { kind: 'start' })
  console.log('\n--- conversa ---')
  for (const effect of collapseSays(abertura.effects)) {
    if (effect.kind === 'say') console.log('bot >', effect.text.split('\n')[0])
  }

  const resposta = advance(graph, abertura.state, {
    kind: 'text',
    text: '14/03/1986',
  })
  console.log('cliente > 14/03/1986')
  for (const effect of collapseSays(resposta.effects)) {
    if (effect.kind === 'say') console.log('bot >', effect.text.split('\n')[0])
  }
  console.log('vars:', resposta.state?.vars)

  const escolha = advance(graph, resposta.state, { kind: 'text', text: '3' })
  console.log('cliente > 3')
  for (const effect of collapseSays(escolha.effects)) {
    if (effect.kind === 'say') console.log('bot >', effect.text)
    else console.log('[', effect.kind, ']')
  }

  const listagem = await flows.listByAppId(app.id)
  const resumo = listagem.find(f => f.id === criada.id)
  console.log('\nresumo da listagem:', resumo?.name, resumo?.nodeCount, 'nós')

  await bindings.delete(app.id, vinculo.id)
  await flows.delete(app.id, criada.id)
  console.log('limpeza ok:', (await flows.getById(app.id, criada.id)) === null)
}

void main()
  .catch(error => {
    console.error('FALHOU:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
