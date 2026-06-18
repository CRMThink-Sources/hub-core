import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

/**
 * Armazenamento de opções por-app no próprio Bitrix24 (app.option.get/set).
 * Público. Valores são strings — serialize/parse JSON no chamador.
 * set exige admin + contexto de app; get exige contexto de app.
 */
export class BitrixAppOptionService {
  constructor(private readonly bitrix: BitrixClient) {}

  async get(key: string): Promise<string | null> {
    const data = await this.bitrix.callMethod<{ result?: unknown }>(
      'app.option.get',
      { option: key },
    )
    const value = data?.result
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  async set(key: string, value: string): Promise<void> {
    await this.bitrix.callMethod('app.option.set', {
      options: { [key]: value },
    })
  }
}
