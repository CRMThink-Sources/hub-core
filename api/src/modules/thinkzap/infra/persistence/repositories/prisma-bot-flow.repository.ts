import { randomUUID } from 'node:crypto'
import type { Prisma } from '@/prisma/client'
import { prisma } from '@/config/prisma'
import type { BotFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow'
import { EMPTY_GRAPH } from '@/modules/thinkzap/domain/bot-flow/empty-flow'
import { parseBotFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow.schema'
import type {
  BotFlow,
  BotFlowStatus,
  BotFlowSummary,
  CountBotFlowsRepository,
  CreateBotFlowRepository,
  DeleteBotFlowRepository,
  ExistsBotFlowNameRepository,
  GetBotFlowRepository,
  ListBotFlowsRepository,
  PublishBotFlowRepository,
  UpdateBotFlowRepository,
} from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'

type FlowRow = {
  id: string
  appId: string
  name: string
  status: string
  version: number
  graph: unknown
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Grafo ilegível cai para fluxo vazio: recusar deixaria o usuário sem conserto. */
function mapFlow(row: FlowRow): BotFlow {
  return {
    id: row.id,
    appId: row.appId,
    name: row.name,
    status: row.status as BotFlowStatus,
    version: row.version,
    graph: parseBotFlowGraph(row.graph) ?? EMPTY_GRAPH,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function countNodes(graph: unknown): number {
  if (graph && typeof graph === 'object' && 'nodes' in graph) {
    const nodes = (graph as { nodes?: unknown }).nodes
    if (Array.isArray(nodes)) return nodes.length
  }
  return 0
}

export class PrismaBotFlowRepository
  implements
    ListBotFlowsRepository,
    GetBotFlowRepository,
    CreateBotFlowRepository,
    UpdateBotFlowRepository,
    PublishBotFlowRepository,
    DeleteBotFlowRepository,
    CountBotFlowsRepository,
    ExistsBotFlowNameRepository
{
  async listByAppId(appId: string): Promise<BotFlowSummary[]> {
    const rows = await prisma.thinkzapBotFlow.findMany({
      where: { appId },
      orderBy: { updatedAt: 'desc' },
    })

    return rows.map(row => {
      const { graph, ...rest } = mapFlow(row)
      void graph
      return { ...rest, nodeCount: countNodes(row.graph) }
    })
  }

  // Sem filtro de `status`: não há como arquivar pela API (`delete` remove de verdade),
  // então filtrar abriria a porta para uma contagem que nada mais reduziria.
  async countByAppId(appId: string): Promise<number> {
    return prisma.thinkzapBotFlow.count({ where: { appId } })
  }

  async getById(appId: string, flowId: string): Promise<BotFlow | null> {
    const row = await prisma.thinkzapBotFlow.findFirst({
      where: { id: flowId, appId },
    })
    return row ? mapFlow(row) : null
  }

  async create(input: {
    appId: string
    name: string
    graph: BotFlowGraph
  }): Promise<BotFlow> {
    const row = await prisma.thinkzapBotFlow.create({
      data: {
        id: randomUUID(),
        appId: input.appId,
        name: input.name,
        graph: input.graph as unknown as Prisma.InputJsonValue,
      },
    })
    return mapFlow(row)
  }

  async update(
    appId: string,
    flowId: string,
    input: { name?: string; graph?: BotFlowGraph },
  ): Promise<BotFlow> {
    // `updateMany` para o `where` carregar o `appId`: sem isso, id de outro portal seria
    // editável.
    await prisma.thinkzapBotFlow.updateMany({
      where: { id: flowId, appId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.graph === undefined
          ? {}
          : { graph: input.graph as unknown as Prisma.InputJsonValue }),
      },
    })

    const row = await prisma.thinkzapBotFlow.findFirstOrThrow({
      where: { id: flowId, appId },
    })
    return mapFlow(row)
  }

  async publish(appId: string, flowId: string): Promise<BotFlow> {
    await prisma.thinkzapBotFlow.updateMany({
      where: { id: flowId, appId },
      data: {
        status: 'PUBLISHED',
        version: { increment: 1 },
        publishedAt: new Date(),
      },
    })

    const row = await prisma.thinkzapBotFlow.findFirstOrThrow({
      where: { id: flowId, appId },
    })
    return mapFlow(row)
  }

  async delete(appId: string, flowId: string): Promise<void> {
    await prisma.thinkzapBotFlow.deleteMany({ where: { id: flowId, appId } })
  }

  async existsName(
    appId: string,
    name: string,
    exceptFlowId?: string,
  ): Promise<boolean> {
    const row = await prisma.thinkzapBotFlow.findFirst({
      where: {
        appId,
        name,
        ...(exceptFlowId ? { id: { not: exceptFlowId } } : {}),
      },
      select: { id: true },
    })
    return row !== null
  }
}
