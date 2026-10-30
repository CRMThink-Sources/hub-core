import type {
  CrmthinkTask,
  CrmthinkTasksGateway,
  CrmthinkUser,
  NewCrmthinkTask,
} from '../../domain/ports/crmthink-tasks-gateway.port'
import {
  CRMTHINK_TASKS_BATCH_SIZE,
  CRMTHINK_TASKS_SEARCH_LIMIT,
} from '../../domain/ports/crmthink-tasks-gateway.port'
import { CrmthinkTasksUnavailableError } from '../../domain/errors/product-update.errors'

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
 * - `user.search` → `{ result: [{ ID, NAME, LAST_NAME, EMAIL, ACTIVE }] }`.
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
      if (TASK_NOT_FOUND_MARKERS.some(marker => message.includes(marker))) {
        return null
      }
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
