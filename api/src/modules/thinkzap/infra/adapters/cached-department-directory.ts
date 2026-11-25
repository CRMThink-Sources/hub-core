import type {
  Department,
  DepartmentDirectory,
} from '@/modules/thinkzap/domain/ports/department-directory.port'
import { apiLogger } from '@/shared/infra/logger'

/** Prazo para uma mudança de hierarquia no portal passar a valer (spec). */
const TTL_MS = 5 * 60_000

type Entry = { departments: Department[]; loadedAt: number }

/**
 * Cache em memória da estrutura de departamentos, por instalação.
 *
 * Existe porque a hierarquia é lida no caminho de envio do widget. Uma busca em voo
 * por instalação e, quando a atualização falha, vale a última lista conhecida: uma
 * oscilação do Bitrix não pode tirar a linha de quem já tinha acesso.
 */
export class CachedDepartmentDirectory implements DepartmentDirectory {
  private readonly entries = new Map<string, Entry>()
  private readonly inFlight = new Map<string, Promise<Department[]>>()
  private readonly now: () => number

  constructor(
    private readonly inner: DepartmentDirectory,
    options: { now?: () => number } = {},
  ) {
    this.now = options.now ?? Date.now
  }

  list(installedAppId: string): Promise<Department[]> {
    const entry = this.entries.get(installedAppId)
    if (entry && this.now() - entry.loadedAt < TTL_MS) {
      return Promise.resolve(entry.departments)
    }

    const pending = this.inFlight.get(installedAppId)
    if (pending) return pending

    const load = this.load(installedAppId).finally(() => {
      this.inFlight.delete(installedAppId)
    })
    this.inFlight.set(installedAppId, load)
    return load
  }

  private async load(installedAppId: string): Promise<Department[]> {
    try {
      const departments = await this.inner.list(installedAppId)
      this.entries.set(installedAppId, { departments, loadedAt: this.now() })
      return departments
    } catch (error) {
      const stale = this.entries.get(installedAppId)
      if (!stale) throw error
      apiLogger.warn(
        {
          appId: installedAppId,
          err: error instanceof Error ? error.message : String(error),
        },
        'Departamentos do portal não atualizados — usando a última lista conhecida',
      )
      return stale.departments
    }
  }
}
