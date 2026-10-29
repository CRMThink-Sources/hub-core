import type { CrmthinkTaskSnapshot } from '../apply-task-status'

/** Teto de IDs por chamada de `tasks.task.list` em `getTasks` (uma página do Bitrix). */
export const CRMTHINK_TASKS_BATCH_SIZE = 50

/** Teto de resultados da busca de tarefas por título. */
export const CRMTHINK_TASKS_SEARCH_LIMIT = 20

/** Tarefa do portal da CRMThink: o que a regra usa + o responsável, para a tela. */
export type CrmthinkTask = CrmthinkTaskSnapshot & {
  responsibleId: number | null
  /** Nome do responsável quando o Bitrix o devolve junto; senão `null`. */
  responsibleName: string | null
}

/** Usuário ativo do portal da CRMThink, candidato a responsável. */
export type CrmthinkUser = {
  id: number
  name: string
  email: string | null
}

export type NewCrmthinkTask = {
  title: string
  description: string
  groupId: number
  responsibleId: number
}

/**
 * Tarefas e usuários do portal Bitrix24 da CRMThink (D4). Toda falha de transporte
 * ou do Bitrix rejeita com `CrmthinkTasksUnavailableError` — exceto a tarefa que
 * não existe (ou que o usuário do webhook não enxerga) em `getTask`, que é `null`.
 */
export interface CrmthinkTasksGateway {
  getTask(id: number): Promise<CrmthinkTask | null>
  /** Por trecho do título, no grupo dado, mais recentes primeiro, até 20. */
  searchTasks(term: string, groupId: number): Promise<CrmthinkTask[]>
  /**
   * Várias por ID, em chamadas de até 50. As ausentes no resultado não existem mais
   * (ou não são visíveis). Falha de qualquer lote rejeita tudo: quem precisa isolar
   * falha por lote (a reconciliação) chama com no máximo `CRMTHINK_TASKS_BATCH_SIZE`.
   */
  getTasks(ids: number[]): Promise<CrmthinkTask[]>
  createTask(input: NewCrmthinkTask): Promise<CrmthinkTask>
  /** Conclui. Tarefa com controle do criador fica "aguardando controle" (4). */
  completeTask(id: number): Promise<void>
  /** Reabre. */
  renewTask(id: number): Promise<void>
  /** Usuários ativos por nome ou e-mail. */
  searchUsers(term: string): Promise<CrmthinkUser[]>
}

/** Configuração da integração, injetada nos casos de uso (vem de `env.crmthinkTasks`). */
export type CrmthinkTasksConfig = {
  /** Desligada: criar, concluir e reabrir tarefas é recusado (`TasksSyncDisabledError`). */
  syncEnabled: boolean
  /** Projeto onde a busca por texto procura e onde as tarefas são criadas. */
  groupId: number
}
