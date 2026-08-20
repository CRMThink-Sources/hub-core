import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { SpaParentReader } from '@/modules/application/application/invalidate-spa-cache'

/**
 * Lê o campo parent de um item de SPA (`parentId1060` numa assinatura,
 * `parentId1142` num item) para descobrir qual chave de listagem invalidar.
 *
 * Devolve `null` quando o item não existe mais ou o campo vem vazio; quem chama
 * trata `null` como "não sei o pai" e cai para a varredura por padrão. A exceção do
 * `BitrixClient` sobe: o chamador já a converte no mesmo `null`, e engolir aqui
 * apagaria a distinção entre "sem pai" e "Bitrix fora do ar" no log.
 */
export class BitrixSpaParentReader implements SpaParentReader {
  constructor(private readonly bitrix: BitrixClient) {}

  async getParentId(input: {
    entityTypeId: number
    itemId: string
    parentField: string
  }): Promise<string | null> {
    const response = await this.bitrix.getCrmItem(
      input.entityTypeId,
      input.itemId,
    )

    const value = response.result?.item?.[input.parentField]

    // O Bitrix devolve referência de parent como número; `0` significa sem pai.
    if (typeof value === 'number') return value > 0 ? String(value) : null
    if (typeof value === 'string' && value !== '' && value !== '0') return value

    return null
  }
}
