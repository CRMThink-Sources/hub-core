import type {
  CrmthinkTask,
  CrmthinkTasksConfig,
  CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'

export type CrmthinkTaskSearchResult = CrmthinkTask & {
  /** De outro projeto que não o configurado: a tela mostra o aviso, mas deixa vincular. */
  outsideGroup: boolean
}

/**
 * Campo único de busca de tarefas (vale com a sincronização desligada):
 *
 * - **número**: a tarefa por ID, em qualquer grupo (`outsideGroup` marca as de fora);
 * - **texto**: por trecho do título no projeto configurado, até 20, mais recentes
 *   primeiro.
 *
 * Termo vazio é lista vazia, sem chamar o Bitrix. Falha do Bitrix propaga
 * (`CrmthinkTasksUnavailableError` → `502`).
 */
export class SearchCrmthinkTasks {
  constructor(
    private readonly gateway: CrmthinkTasksGateway,
    private readonly config: CrmthinkTasksConfig,
  ) {}

  async execute(term: string): Promise<CrmthinkTaskSearchResult[]> {
    const query = term.trim().replace(/^#/, '')
    if (!query) return []

    const mark = (task: CrmthinkTask): CrmthinkTaskSearchResult => ({
      ...task,
      outsideGroup: task.groupId !== this.config.groupId,
    })

    if (/^\d+$/.test(query)) {
      const task = await this.gateway.getTask(Number(query))
      return task ? [mark(task)] : []
    }

    const tasks = await this.gateway.searchTasks(query, this.config.groupId)
    return tasks.map(mark)
  }
}
