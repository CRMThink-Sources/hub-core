import type { BX24CallMethodResult } from './types'

export type BitrixUserSearchHit = {
  ID: string
  NAME?: string
  LAST_NAME?: string
  EMAIL?: string
  WORK_POSITION?: string
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

export function searchBitrixUsers(
  find: string,
): Promise<BitrixUserSearchHit[]> {
  return new Promise((resolve, reject) => {
    const BX24 = typeof window !== 'undefined' ? window.BX24 : undefined
    if (!BX24?.callMethod) {
      reject(new Error('BX24.callMethod não disponível.'))
      return
    }

    BX24.callMethod(
      'user.search',
      { FIND: find },
      (result: BX24CallMethodResult) => {
        try {
          const rows = parseCallMethodData<BitrixUserSearchHit[]>(result)
          resolve(Array.isArray(rows) ? rows : [])
        } catch (e) {
          reject(e instanceof Error ? e : new Error('user.search failed'))
        }
      },
    )
  })
}

export function formatBitrixUserName(user: BitrixUserSearchHit): string {
  const parts = [user.NAME, user.LAST_NAME].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : `Usuário #${user.ID}`
}
