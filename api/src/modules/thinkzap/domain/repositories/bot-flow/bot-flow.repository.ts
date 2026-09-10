import type { BotFlowGraph } from '../../bot-flow/flow'

export type BotFlowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type BotFlow = {
  id: string
  appId: string
  name: string
  status: BotFlowStatus
  version: number
  graph: BotFlowGraph
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** Sem o `graph`: a listagem só mostra nome, status e tamanho. */
export type BotFlowSummary = Omit<BotFlow, 'graph'> & { nodeCount: number }

export interface ListBotFlowsRepository {
  listByAppId(appId: string): Promise<BotFlowSummary[]>
}

export interface GetBotFlowRepository {
  getById(appId: string, flowId: string): Promise<BotFlow | null>
}

export interface CreateBotFlowRepository {
  create(input: {
    appId: string
    name: string
    graph: BotFlowGraph
  }): Promise<BotFlow>
}

export interface UpdateBotFlowRepository {
  /** Rascunho. Não toca `status`/`version`/`publishedAt` — publicar é outra rota. */
  update(
    appId: string,
    flowId: string,
    input: { name?: string; graph?: BotFlowGraph },
  ): Promise<BotFlow>
}

export interface PublishBotFlowRepository {
  publish(appId: string, flowId: string): Promise<BotFlow>
}

export interface DeleteBotFlowRepository {
  delete(appId: string, flowId: string): Promise<void>
}

export interface CountBotFlowsRepository {
  countByAppId(appId: string): Promise<number>
}

export interface ExistsBotFlowNameRepository {
  /** `exceptFlowId` permite renomear o fluxo para o próprio nome. */
  existsName(
    appId: string,
    name: string,
    exceptFlowId?: string,
  ): Promise<boolean>
}
