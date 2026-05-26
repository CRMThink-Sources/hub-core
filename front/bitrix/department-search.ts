import type { BX24CallMethodResult } from './types'

export type BitrixDepartmentHit = {
  ID: string | number
  NAME?: string
  PARENT?: string | number | null
}

function parseCallMethodData<T>(result: BX24CallMethodResult): T {
  if (result?.error?.()) {
    const err =
      typeof result.error === 'function' ? result.error() : result.error
    throw new Error(String(err))
  }
  const data = result?.data?.()
  return (data ?? []) as T
}

export function searchBitrixDepartments(
  query?: string,
): Promise<BitrixDepartmentHit[]> {
  return new Promise((resolve, reject) => {
    const BX24 = typeof window !== 'undefined' ? window.BX24 : undefined
    if (!BX24?.callMethod) {
      reject(new Error('BX24.callMethod não disponível.'))
      return
    }

    const params: Record<string, unknown> = {}
    if (query && query.trim().length > 0) {
      params.NAME = query.trim()
    }

    BX24.callMethod(
      'department.get',
      params,
      (result: BX24CallMethodResult) => {
        try {
          const rows = parseCallMethodData<BitrixDepartmentHit[]>(result)
          resolve(Array.isArray(rows) ? rows : [])
        } catch (e) {
          reject(e instanceof Error ? e : new Error('department.get failed'))
        }
      },
    )
  })
}

export function formatBitrixDepartmentName(dept: BitrixDepartmentHit): string {
  return dept.NAME?.trim() || `Departamento #${dept.ID}`
}
