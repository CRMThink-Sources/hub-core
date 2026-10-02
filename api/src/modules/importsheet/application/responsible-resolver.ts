import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import { logImportsheetError } from '../errors/catalog'

export type ResponsibleMatchBy = 'id' | 'email' | 'phone'

type UserGetResponse = { result?: { ID?: string | number }[] }

const PHONE_FIELDS = ['PERSONAL_MOBILE', 'WORK_PHONE', 'UF_PHONE_INNER']

// Não encontrado → null, mantendo o responsável default.
export class ResponsibleResolver {
  private readonly cache = new Map<string, Promise<string | null>>()

  constructor(private readonly bitrix: BitrixClient) {}

  resolve(
    matchBy: ResponsibleMatchBy,
    rawValue: string,
  ): Promise<string | null> {
    const value = rawValue.trim()
    if (value === '') return Promise.resolve(null)

    const key = `${matchBy}:${value}`
    let pending = this.cache.get(key)
    if (!pending) {
      pending = this.lookup(matchBy, value)
      this.cache.set(key, pending)
    }
    return pending
  }

  private async lookup(
    matchBy: ResponsibleMatchBy,
    value: string,
  ): Promise<string | null> {
    try {
      if (matchBy === 'id') return await this.userGet({ ID: value })
      if (matchBy === 'email') return await this.userGet({ EMAIL: value })
      for (const field of PHONE_FIELDS) {
        const id = await this.userGet({ [field]: value })
        if (id) return id
      }
      return null
    } catch (error) {
      logImportsheetError(
        apiLogger,
        'importsheet.bitrix.user_lookup_failed',
        { app: 'importsheet', matchBy, value, err: error },
        { msg: 'Falha ao resolver responsável — mantém o default' },
      )
      return null
    }
  }

  private async userGet(
    filter: Record<string, string>,
  ): Promise<string | null> {
    const res = await this.bitrix.callMethod<UserGetResponse>('user.get', {
      filter: { ...filter, ACTIVE: true },
    })
    const id = res.result?.[0]?.ID
    return id != null ? String(id) : null
  }
}
