import type { BotFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow'

export type BotSessionStatus =
  | 'ACTIVE'
  | 'HANDED_OFF'
  | 'FINISHED'
  | 'ABORTED'
  | 'EXPIRED'

export type BotSession = {
  id: string
  appId: string
  bitrixChatId: string
  flowId: string
  flowVersion: number
  // Snapshot do grafo publicado quando a sessão começou: republicar o fluxo no meio de um
  // atendimento mudaria as opções sob os pés de quem já respondeu.
  graph: BotFlowGraph
  bindingId: string | null
  currentNodeId: string
  vars: Record<string, string>
  attempts: number
  status: BotSessionStatus
  /** Quando a sessão começou. Usado para reconhecer evento repetido do mesmo início. */
  createdAt: Date
}

export interface GetActiveBotSessionRepository {
  /** `null` também quando a sessão expirou. */
  getActiveByChatId(appId: string, chatId: string): Promise<BotSession | null>
}

export interface GetHandedOffBotSessionRepository {
  /**
   * Quando o chat foi entregue ao atendimento humano pela última vez, ou `null` se nunca.
   *
   * Existe porque `getActiveByChatId` só vê `ACTIVE`: sem consultar o handoff, a mensagem
   * seguinte do cliente não encontrava sessão, abria uma nova e o bot recomeçava o fluxo
   * por cima do atendente.
   */
  handoffAtByChatId(appId: string, chatId: string): Promise<Date | null>
}

export interface CreateBotSessionRepository {
  create(input: {
    appId: string
    bitrixChatId: string
    flowId: string
    flowVersion: number
    graph: BotFlowGraph
    bindingId: string | null
    currentNodeId: string
    vars: Record<string, string>
    attempts: number
    expiresAt: Date
  }): Promise<BotSession>
}

export interface UpdateBotSessionRepository {
  advance(
    id: string,
    input: {
      currentNodeId: string
      vars: Record<string, string>
      attempts: number
      expiresAt: Date
    },
  ): Promise<void>

  close(id: string, status: Exclude<BotSessionStatus, 'ACTIVE'>): Promise<void>
}
