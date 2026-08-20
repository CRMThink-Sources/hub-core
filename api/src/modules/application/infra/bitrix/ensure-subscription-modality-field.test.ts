import { describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  SUBSCRIPTION_MODALITY_FIELD,
  SubscriptionModalityFieldIsEnumerationError,
  SubscriptionModalityFieldMissingError,
  ensureSubscriptionModalityField,
} from './ensure-subscription-modality-field'

const bitrixWithFields = (fields: Record<string, { type?: string }>) =>
  ({
    getCrmItemFields: vi.fn().mockResolvedValue({ result: { fields } }),
  }) as unknown as BitrixClient

describe('ensureSubscriptionModalityField', () => {
  it('passa quando o campo existe como texto', async () => {
    await expect(
      ensureSubscriptionModalityField(
        bitrixWithFields({ [SUBSCRIPTION_MODALITY_FIELD]: { type: 'string' } }),
        1142,
      ),
    ).resolves.toBeUndefined()
  })

  it('falha alto quando o campo não existe', async () => {
    await expect(
      ensureSubscriptionModalityField(
        bitrixWithFields({ ufCrm91Status: {} }),
        1142,
      ),
    ).rejects.toBeInstanceOf(SubscriptionModalityFieldMissingError)
  })

  /**
   * Campo de lista devolve id de enum, então a leitura literal resolveria
   * `manual` para toda assinatura — a falha silenciosa que a verificação existe
   * para impedir, só com a causa deslocada de "não existe" para "existe errado".
   */
  it('falha quando o campo é de lista', async () => {
    await expect(
      ensureSubscriptionModalityField(
        bitrixWithFields({
          [SUBSCRIPTION_MODALITY_FIELD]: { type: 'enumeration' },
        }),
        1142,
      ),
    ).rejects.toBeInstanceOf(SubscriptionModalityFieldIsEnumerationError)
  })

  it('trata resposta sem fields como campo ausente', async () => {
    const bitrix = {
      getCrmItemFields: vi.fn().mockResolvedValue({}),
    } as unknown as BitrixClient

    await expect(
      ensureSubscriptionModalityField(bitrix, 1142),
    ).rejects.toBeInstanceOf(SubscriptionModalityFieldMissingError)
  })
})
