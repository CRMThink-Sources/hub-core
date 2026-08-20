import { describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  SUBSCRIPTION_ITEM_PROVIDER_FIELD,
  SubscriptionItemProviderFieldIsEnumerationError,
  SubscriptionItemProviderFieldMissingError,
  ensureSubscriptionItemProviderField,
} from './ensure-subscription-item-provider-field'

const bitrixWithFields = (fields: Record<string, { type?: string }>) =>
  ({
    getCrmItemFields: vi.fn().mockResolvedValue({ result: { fields } }),
  }) as unknown as BitrixClient

describe('ensureSubscriptionItemProviderField', () => {
  it('passa quando o campo existe como texto', async () => {
    await expect(
      ensureSubscriptionItemProviderField(
        bitrixWithFields({
          [SUBSCRIPTION_ITEM_PROVIDER_FIELD]: { type: 'string' },
        }),
        1146,
      ),
    ).resolves.toBeUndefined()
  })

  it('falha alto quando o campo não existe', async () => {
    await expect(
      ensureSubscriptionItemProviderField(
        bitrixWithFields({ ufCrm93Status: {} }),
        1146,
      ),
    ).rejects.toBeInstanceOf(SubscriptionItemProviderFieldMissingError)
  })

  /**
   * Campo de lista devolve id de enum, e a leitura do item compara valor literal —
   * então nenhum item resolveria provider nenhum. O sintoma seria a SPA inteira
   * reprovando o parse, com a causa apontando para o valor gravado em vez do tipo
   * do campo.
   */
  it('falha quando o campo é de lista', async () => {
    await expect(
      ensureSubscriptionItemProviderField(
        bitrixWithFields({
          [SUBSCRIPTION_ITEM_PROVIDER_FIELD]: { type: 'enumeration' },
        }),
        1146,
      ),
    ).rejects.toBeInstanceOf(SubscriptionItemProviderFieldIsEnumerationError)
  })

  it('trata resposta sem fields como campo ausente', async () => {
    const bitrix = {
      getCrmItemFields: vi.fn().mockResolvedValue({}),
    } as unknown as BitrixClient

    await expect(
      ensureSubscriptionItemProviderField(bitrix, 1146),
    ).rejects.toBeInstanceOf(SubscriptionItemProviderFieldMissingError)
  })
})
