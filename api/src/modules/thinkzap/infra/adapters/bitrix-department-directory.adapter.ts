import type {
  Department,
  DepartmentDirectory,
} from '@/modules/thinkzap/domain/ports/department-directory.port'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'

type DepartmentRow = {
  ID?: string | number
  NAME?: string
  PARENT?: string | number | null
}

type DepartmentPage = { result?: DepartmentRow[]; next?: number }

/**
 * Lê todos os departamentos (`department.get`, 50 por página) com a credencial da
 * instalação. Exige o escopo `department` no app.
 */
export class BitrixDepartmentDirectory implements DepartmentDirectory {
  constructor(
    private readonly clientFor: (
      installedAppId: string,
    ) => Promise<Pick<BitrixClient, 'callMethod'>>,
  ) {}

  async list(installedAppId: string): Promise<Department[]> {
    const client = await this.clientFor(installedAppId)
    const departments: Department[] = []

    for (let start: number | undefined = 0; start !== undefined; ) {
      const page: DepartmentPage = await client.callMethod<DepartmentPage>(
        'department.get',
        { start },
      )
      // Sem a lista, devolver vazio faria o cache guardar "portal sem setores".
      if (!Array.isArray(page.result)) {
        throw new Error('Resposta inesperada do department.get')
      }
      for (const row of page.result) {
        if (row.ID === undefined || row.ID === null) continue
        departments.push({
          id: String(row.ID),
          name: row.NAME?.trim() || `Departamento #${row.ID}`,
          parentId: row.PARENT ? String(row.PARENT) : null,
        })
      }
      start = page.next
    }

    return departments
  }
}
