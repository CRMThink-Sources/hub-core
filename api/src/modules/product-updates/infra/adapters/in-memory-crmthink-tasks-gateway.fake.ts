import { CRMTHINK_TASK_STATUS } from '../../domain/apply-task-status'
import { CrmthinkTasksUnavailableError } from '../../domain/errors/product-update.errors'
import type {
  CrmthinkTask,
  CrmthinkTasksGateway,
  CrmthinkUser,
  NewCrmthinkTask,
} from '../../domain/ports/crmthink-tasks-gateway.port'

type GatewayCall = { method: keyof CrmthinkTasksGateway; args: unknown[] }

/**
 * Portal da CRMThink de mentira para os testes dos casos de uso. Guarda as tarefas,
 * registra cada chamada em `calls` e falha tudo com `failing = true`.
 *
 * `completeTask` vai para 5, ou para 4 nas tarefas em `requiresApproval` (controle do
 * criador); `renewTask` volta para 2.
 */
export class InMemoryCrmthinkTasksGateway implements CrmthinkTasksGateway {
  readonly tasks = new Map<number, CrmthinkTask>()
  readonly calls: GatewayCall[] = []
  readonly requiresApproval = new Set<number>()
  failing = false
  private nextId = 9000

  constructor(
    tasks: CrmthinkTask[] = [],
    readonly users: CrmthinkUser[] = [],
  ) {
    for (const task of tasks) this.tasks.set(task.id, { ...task })
  }

  getTask(id: number): Promise<CrmthinkTask | null> {
    return this.run('getTask', [id], () => {
      const task = this.tasks.get(id)
      return task ? { ...task } : null
    })
  }

  searchTasks(term: string, groupId: number): Promise<CrmthinkTask[]> {
    return this.run('searchTasks', [term, groupId], () =>
      [...this.tasks.values()]
        .filter(
          t =>
            t.groupId === groupId &&
            t.title.toLowerCase().includes(term.toLowerCase()),
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, 20),
    )
  }

  getTasks(ids: number[]): Promise<CrmthinkTask[]> {
    return this.run('getTasks', [ids], () =>
      ids.flatMap(id => {
        const task = this.tasks.get(id)
        return task ? [{ ...task }] : []
      }),
    )
  }

  createTask(input: NewCrmthinkTask): Promise<CrmthinkTask> {
    return this.run('createTask', [input], () => {
      const task: CrmthinkTask = {
        id: this.nextId++,
        title: input.title,
        status: 2,
        groupId: input.groupId,
        responsibleId: input.responsibleId,
        responsibleName: null,
      }
      this.tasks.set(task.id, task)
      return { ...task }
    })
  }

  completeTask(id: number): Promise<void> {
    return this.run('completeTask', [id], () => {
      const task = this.mustGet(id)
      task.status = this.requiresApproval.has(id)
        ? CRMTHINK_TASK_STATUS.AWAITING_CONTROL
        : CRMTHINK_TASK_STATUS.COMPLETED
    })
  }

  renewTask(id: number): Promise<void> {
    return this.run('renewTask', [id], () => {
      this.mustGet(id).status = 2
    })
  }

  searchUsers(term: string): Promise<CrmthinkUser[]> {
    return this.run('searchUsers', [term], () =>
      this.users.filter(u =>
        `${u.name} ${u.email ?? ''}`.toLowerCase().includes(term.toLowerCase()),
      ),
    )
  }

  /** Quantas chamadas de um método (ou de todos). */
  count(method?: keyof CrmthinkTasksGateway): number {
    return this.calls.filter(c => !method || c.method === method).length
  }

  private mustGet(id: number): CrmthinkTask {
    const task = this.tasks.get(id)
    if (!task)
      throw new CrmthinkTasksUnavailableError(`tarefa ${id} não existe`)
    return task
  }

  private run<T>(
    method: keyof CrmthinkTasksGateway,
    args: unknown[],
    fn: () => T,
  ): Promise<T> {
    this.calls.push({ method, args })
    if (this.failing) {
      return Promise.reject(
        new CrmthinkTasksUnavailableError('Bitrix fora do ar'),
      )
    }
    try {
      return Promise.resolve(fn())
    } catch (error) {
      return Promise.reject(error as Error)
    }
  }
}

/** Tarefa de teste: em andamento, no grupo 2677 — sobrescreva o que importa. */
export function buildCrmthinkTask(
  overrides: Partial<CrmthinkTask> = {},
): CrmthinkTask {
  return {
    id: 42,
    title: 'Envio de template com imagem',
    status: 3,
    groupId: 2677,
    responsibleId: 15,
    responsibleName: 'Maria Souza',
    ...overrides,
  }
}
