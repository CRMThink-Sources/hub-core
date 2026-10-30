import type { CrmthinkTaskSnapshot } from '../apply-task-status'

/** Teto de IDs por chamada de `tasks.task.list` em `getTasks` (uma página do Bitrix). */
export const CRMTHINK_TASKS_BATCH_SIZE = 50

/** Teto de resultados da busca de tarefas por título. */
export const CRMTHINK_TASKS_SEARCH_LIMIT = 20

/** Teto de mensagens lidas da conversa da tarefa (uma página do Bitrix). */
export const CRMTHINK_TASK_MESSAGES_LIMIT = 50

/** Tamanho máximo do texto enviado à conversa da tarefa. */
export const CRMTHINK_TASK_MESSAGE_MAX_LENGTH = 4000

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

/** Mensagem da conversa da tarefa (comentário do cartão antigo ou mensagem do chat). */
export type CrmthinkTaskMessage = {
  id: number
  authorId: number | null
  authorName: string | null
  /** Texto como o Bitrix guarda, podendo conter BBCode; só com `trim`. */
  text: string
  /** ISO 8601. */
  createdAt: string
  /** Mensagem automática do Bitrix (sem autor), não escrita por uma pessoa. */
  isSystem: boolean
}

/**
 * Conversa da tarefa, da mais antiga para a mais nova (até 50). `chat` é o cartão
 * novo (comentários são mensagens do chat); `comments` é o cartão antigo (D13).
 */
export type CrmthinkTaskMessages = {
  mode: 'chat' | 'comments'
  messages: CrmthinkTaskMessage[]
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
  /**
   * Conversa da tarefa (D13). Tarefa ilegível rejeita com `CrmthinkTaskNotFoundError`.
   */
  listTaskMessages(taskId: number): Promise<CrmthinkTaskMessages>
  /**
   * Comenta na tarefa em nome do usuário do Bitrix dado (`AUTHOR_ID`). Se esse
   * caminho falhar, tenta o método atual do chat da tarefa, que não aceita autor: o
   * texto sai em nome do dono do webhook, prefixado com o nome de quem enviou
   * (`attributedToAuthor: false`). Tarefa ilegível rejeita com
   * `CrmthinkTaskNotFoundError`.
   */
  sendTaskMessage(
    taskId: number,
    text: string,
    author: CrmthinkTaskMessageAuthor,
  ): Promise<SendTaskMessageResult>
}

/** Quem envia uma mensagem pelo backoffice. */
export type CrmthinkTaskMessageAuthor = {
  /** ID do usuário no Bitrix da CRMThink. */
  bitrixUserId: number
  /** Nome exibido, usado no prefixo quando a mensagem não pode sair no nome dele. */
  name: string
}

export type SendTaskMessageResult = {
  /** `false` quando a mensagem saiu em nome do dono do webhook, com o nome no texto. */
  attributedToAuthor: boolean
}

/** Configuração da integração, injetada nos casos de uso (vem de `env.crmthinkTasks`). */
export type CrmthinkTasksConfig = {
  /** Desligada: criar, concluir e reabrir tarefas é recusado (`TasksSyncDisabledError`). */
  syncEnabled: boolean
  /** Projeto onde a busca por texto procura e onde as tarefas são criadas. */
  groupId: number
}
