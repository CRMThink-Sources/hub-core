import type { BindingCondition } from '../../bot-flow/binding-condition'

export type BotFlowBinding = {
  id: string
  appId: string
  flowId: string
  lineId: string
  priority: number
  active: boolean
  condition: BindingCondition | null
  createdAt: Date
  updatedAt: Date
}

/** Vínculo com o nome do fluxo, para a tela não precisar cruzar duas listas. */
export type BotFlowBindingWithFlow = BotFlowBinding & {
  flowName: string
  flowStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

export interface ListBotFlowBindingsRepository {
  listByAppId(appId: string): Promise<BotFlowBindingWithFlow[]>
}

export interface CreateBotFlowBindingRepository {
  create(input: {
    appId: string
    flowId: string
    lineId: string
    priority: number
    active: boolean
    condition: BindingCondition | null
  }): Promise<BotFlowBinding>
}

export interface UpdateBotFlowBindingRepository {
  update(
    appId: string,
    bindingId: string,
    input: {
      lineId?: string
      priority?: number
      active?: boolean
      condition?: BindingCondition | null
    },
  ): Promise<BotFlowBinding>
}

export interface DeleteBotFlowBindingRepository {
  delete(appId: string, bindingId: string): Promise<void>
}

export interface GetBotFlowBindingRepository {
  getById(appId: string, bindingId: string): Promise<BotFlowBinding | null>
}

// Para o controller recusar com mensagem em vez de deixar a `@@unique` estourar como erro
// de banco: a tela precisa dizer qual fluxo está ocupando a linha.
export interface GetBotFlowBindingByLineRepository {
  getByLineId(appId: string, lineId: string): Promise<BotFlowBinding | null>
}
