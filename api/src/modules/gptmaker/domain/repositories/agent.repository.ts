import type { LocalAgent } from '../entities/agent'
import type { Worktime } from '../value-objects/worktime'

export type CreateLocalAgentInput = {
  appId: string
  gptMakerAgentId: string
  name: string | null
}

export type UpdateLocalAgentInput = {
  name?: string | null
  botId?: number | null
  worktime?: Worktime
  exitOnCollaboratorJoin?: boolean
}

/**
 * `core_gpt_agents` — a fronteira entre instalações.
 *
 * Toda leitura por agente é escopada por `appId` de propósito: um método que
 * buscasse só por `gptMakerAgentId` seria o caminho mais curto para vazar o
 * agente de um cliente para outro, porque o id sozinho é aceito pela API do
 * vendor venha de quem vier.
 *
 * A exceção é `findByGptMakerAgentId`, usada pela reconciliação, que precisa
 * justamente descobrir se um agente do workspace pertence a alguém.
 */
export interface AgentRepository {
  create(input: CreateLocalAgentInput): Promise<LocalAgent>

  /** Todos os agentes de uma instalação. */
  listByApp(appId: string): Promise<LocalAgent[]>

  /** Quantos agentes a instalação já tem — para o teto. */
  countByApp(appId: string): Promise<number>

  /**
   * O agente **daquela instalação**. `null` quando não existe ou quando existe
   * mas pertence a outra — os dois casos são indistinguíveis por contrato.
   */
  findOwned(appId: string, gptMakerAgentId: string): Promise<LocalAgent | null>

  /** O agente de uma instalação pelo `botId` vinculado. */
  findOwnedByBotId(appId: string, botId: number): Promise<LocalAgent | null>

  update(id: string, input: UpdateLocalAgentInput): Promise<LocalAgent>

  delete(id: string): Promise<void>

  /**
   * Busca sem escopo de instalação. **Só** para a reconciliação, que compara o
   * workspace inteiro com o banco e precisa saber se um agente tem dono.
   */
  findByGptMakerAgentId(gptMakerAgentId: string): Promise<LocalAgent | null>

  /** Todos os agentes, de todas as instalações. Só para a reconciliação. */
  listAll(): Promise<LocalAgent[]>
}
