import type {
  CrmthinkTask,
  CrmthinkTaskMessage,
  CrmthinkTaskMessages,
  CrmthinkTasksGateway,
  CrmthinkUser,
  NewCrmthinkTask,
} from '../../domain/ports/crmthink-tasks-gateway.port'
import {
  CRMTHINK_TASK_MESSAGES_LIMIT,
  CRMTHINK_TASKS_BATCH_SIZE,
  CRMTHINK_TASKS_SEARCH_LIMIT,
} from '../../domain/ports/crmthink-tasks-gateway.port'
import {
  CrmthinkTaskNotFoundError,
  CrmthinkTasksUnavailableError,
} from '../../domain/errors/product-update.errors'

/**
 * O mínimo do `BitrixClient` que o adapter usa. `BitrixClient.callMethod` devolve o
 * envelope inteiro (`{ result, time }`) e lança `BitrixError` com a mensagem
 * `Bitrix error: <status> - <corpo JSON>` em resposta HTTP de erro.
 */
export type CrmthinkBitrixCaller = {
  callMethod(method: string, params: Record<string, unknown>): Promise<unknown>
}

/** `select` dos `tasks.task.*` usa os nomes em maiúsculas; a resposta vem em camelCase. */
const TASK_SELECT = ['ID', 'TITLE', 'STATUS', 'GROUP_ID', 'RESPONSIBLE_ID']

/**
 * Códigos (estáveis, não traduzidos) que o Bitrix põe na `error_description` de
 * `tasks.task.get` para tarefa inexistente ou fora do alcance do usuário do webhook:
 * `256/TE/TASK_NOT_FOUND_OR_NOT_ACCESSIBLE` e `8/TE/ACTION_NOT_ALLOWED` (o que
 * versões mais antigas devolvem para tarefa excluída). Os dois viram `null`: para o
 * vínculo é "tarefa não encontrada" e para o worker é "tarefa sumiu", o mesmo que a
 * reconciliação conclui quando o `tasks.task.list` não a devolve. Falta de escopo
 * (`insufficient_scope`), `401`, rede etc. seguem como indisponibilidade.
 */
const TASK_NOT_FOUND_MARKERS = [
  'TASK_NOT_FOUND_OR_NOT_ACCESSIBLE',
  'ACTION_NOT_ALLOWED',
]

const isTaskNotFound = (message: string): boolean =>
  TASK_NOT_FOUND_MARKERS.some(marker => message.includes(marker))

type RawRecord = Record<string, unknown>

const isRecord = (value: unknown): value is RawRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Inteiro positivo de número ou string numérica (o Bitrix devolve os dois). */
function toId(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Campo em camelCase (`tasks.task.*`) ou, por garantia, em maiúsculas. */
function field(raw: RawRecord, camel: string, upper: string): unknown {
  return raw[camel] ?? raw[upper]
}

function toTask(raw: unknown): CrmthinkTask | null {
  if (!isRecord(raw)) return null
  const id = toId(field(raw, 'id', 'ID'))
  if (id === null) return null

  const status = Number(field(raw, 'status', 'STATUS'))
  const responsible = raw.responsible
  const responsibleName =
    isRecord(responsible) && typeof responsible.name === 'string'
      ? responsible.name.trim() || null
      : null

  const title = field(raw, 'title', 'TITLE')

  return {
    id,
    title: typeof title === 'string' ? title : '',
    status: Number.isInteger(status) ? status : 0,
    // `groupId` "0" é tarefa sem projeto.
    groupId: toId(field(raw, 'groupId', 'GROUP_ID')),
    responsibleId: toId(field(raw, 'responsibleId', 'RESPONSIBLE_ID')),
    responsibleName,
  }
}

/** Texto da mensagem (pode ter BBCode) só com `trim`; o resto fica como veio. */
const toText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

/** Data ISO da mensagem; ausente ou ilegível fica como veio (string) ou vazio. */
const toIsoDate = (value: unknown): string =>
  typeof value === 'string' ? value : ''

/** Nome do `users` do `im.dialog.messages.get` (`{ id, name }`). */
function toChatUsers(raw: unknown): Map<number, string> {
  const names = new Map<number, string>()
  if (!Array.isArray(raw)) return names
  for (const user of raw) {
    if (!isRecord(user)) continue
    const id = toId(user.id)
    const name = typeof user.name === 'string' ? user.name.trim() : ''
    if (id !== null && name) names.set(id, name)
  }
  return names
}

/** `author_id` 0 ou ausente é mensagem do sistema. */
function toChatMessage(
  raw: unknown,
  names: Map<number, string>,
): CrmthinkTaskMessage | null {
  if (!isRecord(raw)) return null
  const id = toId(raw.id)
  if (id === null) return null
  const authorId = toId(raw.author_id)
  return {
    id,
    authorId,
    authorName: authorId === null ? null : (names.get(authorId) ?? null),
    text: toText(raw.text),
    createdAt: toIsoDate(raw.date),
    isSystem: authorId === null,
  }
}

/** Comentário do cartão antigo (`task.commentitem.getlist`). */
function toComment(raw: unknown): CrmthinkTaskMessage | null {
  if (!isRecord(raw)) return null
  const id = toId(raw.ID)
  if (id === null) return null
  const authorId = toId(raw.AUTHOR_ID)
  const authorName =
    typeof raw.AUTHOR_NAME === 'string' ? raw.AUTHOR_NAME.trim() : ''
  return {
    id,
    authorId,
    authorName: authorName || null,
    text: toText(raw.POST_MESSAGE),
    createdAt: toIsoDate(raw.POST_DATE),
    isSystem: false,
  }
}

function toUser(raw: unknown): CrmthinkUser | null {
  if (!isRecord(raw)) return null
  const id = toId(raw.ID)
  if (id === null || raw.ACTIVE === false || raw.ACTIVE === 'N') return null

  const email =
    typeof raw.EMAIL === 'string' && raw.EMAIL.trim() ? raw.EMAIL.trim() : null
  const name = [raw.NAME, raw.LAST_NAME]
    .filter((part): part is string => typeof part === 'string')
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ')

  return { id, name: name || email || `#${id}`, email }
}

/** `result` do envelope; um `error` no corpo (HTTP 200) também é falha. */
function unwrap(method: string, response: unknown): unknown {
  if (!isRecord(response)) {
    throw new CrmthinkTasksUnavailableError(`${method}: resposta inesperada`)
  }
  if (typeof response.error === 'string') {
    const description =
      typeof response.error_description === 'string'
        ? response.error_description
        : response.error
    throw new CrmthinkTasksUnavailableError(`${method}: ${description}`)
  }
  return response.result
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Tarefas e usuários do portal da CRMThink pelo webhook de entrada
 * (`CRMTHINK_WEBHOOK_URL`, escopos `task` e `user`). Formatos assumidos:
 *
 * - `tasks.task.get` → `{ result: { task: { id, title, status, groupId, responsibleId,
 *   responsible?: { name } } } }`;
 * - `tasks.task.list` → `{ result: { tasks: [...] } }`, página de 50;
 * - `tasks.task.add` → `{ result: { task: {...} } }`;
 * - `user.search` → `{ result: [{ ID, NAME, LAST_NAME, EMAIL, ACTIVE }] }`;
 * - conversa (D13): `tasks.task.get` com `select: ['ID', 'CHAT_ID']` → `result.task.chatId`
 *   (número ou string; 0, vazio ou ausente = cartão antigo); com chat,
 *   `im.dialog.messages.get` → `{ result: { messages: [{ id, author_id, date, text }],
 *   users: [{ id, name }] } }` (ordem não garantida: ordena por `id`); sem chat,
 *   `task.commentitem.getlist` → `{ result: [{ ID, AUTHOR_ID, AUTHOR_NAME, POST_DATE,
 *   POST_MESSAGE }] }`, do mais novo para o mais antigo (invertido); envio por
 *   `task.commentitem.add` → `{ result: <id do comentário> }`.
 *
 * IDs chegam como string ou número. Qualquer falha vira
 * `CrmthinkTasksUnavailableError` (inclusive a pausa por limite do portal).
 */
export class BitrixCrmthinkTasksGateway implements CrmthinkTasksGateway {
  constructor(private readonly bitrix: CrmthinkBitrixCaller) {}

  async getTask(id: number): Promise<CrmthinkTask | null> {
    let response: unknown
    try {
      response = await this.bitrix.callMethod('tasks.task.get', {
        taskId: id,
        select: TASK_SELECT,
      })
    } catch (error) {
      const message = errorMessage(error)
      if (isTaskNotFound(message)) return null
      throw new CrmthinkTasksUnavailableError(`tasks.task.get: ${message}`)
    }

    const result = unwrap('tasks.task.get', response)
    // Tarefa ausente também chega como `{ task: false }` ou `[]`.
    return isRecord(result) ? toTask(result.task) : null
  }

  async searchTasks(term: string, groupId: number): Promise<CrmthinkTask[]> {
    const tasks = await this.list({ GROUP_ID: groupId, '%TITLE': term })
    return tasks.slice(0, CRMTHINK_TASKS_SEARCH_LIMIT)
  }

  async getTasks(ids: number[]): Promise<CrmthinkTask[]> {
    const unique = [...new Set(ids)]
    const found: CrmthinkTask[] = []
    for (let i = 0; i < unique.length; i += CRMTHINK_TASKS_BATCH_SIZE) {
      const batch = unique.slice(i, i + CRMTHINK_TASKS_BATCH_SIZE)
      found.push(...(await this.list({ ID: batch })))
    }
    return found
  }

  async createTask(input: NewCrmthinkTask): Promise<CrmthinkTask> {
    const result = await this.call('tasks.task.add', {
      fields: {
        TITLE: input.title,
        DESCRIPTION: input.description,
        GROUP_ID: input.groupId,
        RESPONSIBLE_ID: input.responsibleId,
      },
    })
    const created = isRecord(result) ? toTask(result.task) : null
    if (!created) {
      throw new CrmthinkTasksUnavailableError(
        'tasks.task.add: resposta sem o id da tarefa criada',
      )
    }
    // A resposta do add traz a tarefa inteira, mas não custa garantir o que foi pedido.
    return {
      ...created,
      title: created.title || input.title,
      groupId: created.groupId ?? input.groupId,
      responsibleId: created.responsibleId ?? input.responsibleId,
    }
  }

  async completeTask(id: number): Promise<void> {
    await this.call('tasks.task.complete', { taskId: id })
  }

  async renewTask(id: number): Promise<void> {
    await this.call('tasks.task.renew', { taskId: id })
  }

  async searchUsers(term: string): Promise<CrmthinkUser[]> {
    // `FIND` não combina com outros campos no `FILTER`; os inativos saem aqui.
    const result = await this.call('user.search', {
      FILTER: { FIND: term },
    })
    const rows = Array.isArray(result)
      ? result
      : isRecord(result)
        ? Object.values(result)
        : []
    return rows.map(toUser).filter((user): user is CrmthinkUser => !!user)
  }

  async listTaskMessages(taskId: number): Promise<CrmthinkTaskMessages> {
    const chatId = await this.readChatId(taskId)

    if (chatId !== null) {
      const result = await this.call('im.dialog.messages.get', {
        DIALOG_ID: `chat${chatId}`,
        LIMIT: CRMTHINK_TASK_MESSAGES_LIMIT,
      })
      const names = toChatUsers(isRecord(result) ? result.users : null)
      const rows =
        isRecord(result) && Array.isArray(result.messages)
          ? result.messages
          : []
      const messages = rows
        .map(row => toChatMessage(row, names))
        .filter((m): m is CrmthinkTaskMessage => !!m)
        .sort((a, b) => a.id - b.id)
      return { mode: 'chat', messages }
    }

    // No cartão novo este método devolve lista vazia sem erro; por isso o `chatId`
    // é conferido antes.
    const result = await this.call('task.commentitem.getlist', {
      TASKID: taskId,
      ORDER: { ID: 'desc' },
    })
    const rows = Array.isArray(result) ? result : []
    const messages = rows
      .map(toComment)
      .filter((m): m is CrmthinkTaskMessage => !!m)
      .sort((a, b) => a.id - b.id)
    return { mode: 'comments', messages }
  }

  async sendTaskMessage(
    taskId: number,
    text: string,
    authorBitrixUserId: number,
  ): Promise<void> {
    let response: unknown
    try {
      response = await this.bitrix.callMethod('task.commentitem.add', {
        TASKID: taskId,
        FIELDS: { POST_MESSAGE: text, AUTHOR_ID: authorBitrixUserId },
      })
    } catch (error) {
      const message = errorMessage(error)
      if (isTaskNotFound(message)) throw new CrmthinkTaskNotFoundError(taskId)
      throw new CrmthinkTasksUnavailableError(
        `task.commentitem.add: ${message}`,
      )
    }
    unwrap('task.commentitem.add', response)
  }

  /**
   * `chatId` da tarefa (cartão novo) ou `null` (cartão antigo). Tarefa ilegível
   * rejeita com `CrmthinkTaskNotFoundError`.
   */
  private async readChatId(taskId: number): Promise<number | null> {
    let response: unknown
    try {
      response = await this.bitrix.callMethod('tasks.task.get', {
        taskId,
        select: ['ID', 'CHAT_ID'],
      })
    } catch (error) {
      const message = errorMessage(error)
      if (isTaskNotFound(message)) throw new CrmthinkTaskNotFoundError(taskId)
      throw new CrmthinkTasksUnavailableError(`tasks.task.get: ${message}`)
    }
    const result = unwrap('tasks.task.get', response)
    const task = isRecord(result) ? result.task : null
    if (!isRecord(task)) throw new CrmthinkTaskNotFoundError(taskId)
    return toId(field(task, 'chatId', 'CHAT_ID'))
  }

  private async list(filter: RawRecord): Promise<CrmthinkTask[]> {
    const result = await this.call('tasks.task.list', {
      filter,
      select: TASK_SELECT,
      order: { ID: 'desc' },
      start: 0,
    })
    const rows = isRecord(result) ? result.tasks : null
    if (!Array.isArray(rows)) return []
    return rows.map(toTask).filter((task): task is CrmthinkTask => !!task)
  }

  private async call(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    let response: unknown
    try {
      response = await this.bitrix.callMethod(method, params)
    } catch (error) {
      throw new CrmthinkTasksUnavailableError(
        `${method}: ${errorMessage(error)}`,
      )
    }
    return unwrap(method, response)
  }
}
