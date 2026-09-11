import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

const bitrixWithFields = (fields: Record<string, { type?: string }>) => {
  const getCrmItemFields = vi.fn().mockResolvedValue({ result: { fields } })
  return {
    bitrix: { getCrmItemFields } as unknown as BitrixClient,
    getCrmItemFields,
  }
}

/**
 * `vi.resetModules` antes de cada teste: o guard memoiza (`checked`) em variável de
 * módulo, e os testes precisam de um estado limpo cada um — inclusive o teste que
 * verifica a memoização em si, que precisa controlar as duas chamadas sozinho.
 */
describe('ensureSubscriptionItemDeletionFields', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('passa quando os dois campos existem', async () => {
    const {
      ensureSubscriptionItemDeletionFields,
      SUBSCRIPTION_ITEM_DELETED_AT_FIELD,
      SUBSCRIPTION_ITEM_DELETED_BY_FIELD,
    } = await import('./ensure-subscription-item-deletion-fields')
    const { bitrix } = bitrixWithFields({
      [SUBSCRIPTION_ITEM_DELETED_AT_FIELD]: { type: 'datetime' },
      [SUBSCRIPTION_ITEM_DELETED_BY_FIELD]: { type: 'string' },
    })

    await expect(
      ensureSubscriptionItemDeletionFields(bitrix, 1146),
    ).resolves.toBeUndefined()
  })

  it('falha nomeando os dois campos quando ambos ausentes', async () => {
    const {
      ensureSubscriptionItemDeletionFields,
      SubscriptionItemDeletionFieldsMissingError,
    } = await import('./ensure-subscription-item-deletion-fields')
    const { bitrix } = bitrixWithFields({})

    await expect(
      ensureSubscriptionItemDeletionFields(bitrix, 1146),
    ).rejects.toBeInstanceOf(SubscriptionItemDeletionFieldsMissingError)
  })

  it('falha nomeando só o campo que falta, quando só um existe', async () => {
    const {
      ensureSubscriptionItemDeletionFields,
      SUBSCRIPTION_ITEM_DELETED_BY_FIELD,
    } = await import('./ensure-subscription-item-deletion-fields')
    const { bitrix } = bitrixWithFields({
      [SUBSCRIPTION_ITEM_DELETED_BY_FIELD]: { type: 'string' },
    })

    await expect(
      ensureSubscriptionItemDeletionFields(bitrix, 1146),
    ).rejects.toThrow(/ufCrm93DeletedAt/)
  })

  it('trata resposta sem fields como os dois campos ausentes', async () => {
    const {
      ensureSubscriptionItemDeletionFields,
      SubscriptionItemDeletionFieldsMissingError,
    } = await import('./ensure-subscription-item-deletion-fields')
    const bitrix = {
      getCrmItemFields: vi.fn().mockResolvedValue({}),
    } as unknown as BitrixClient

    await expect(
      ensureSubscriptionItemDeletionFields(bitrix, 1146),
    ).rejects.toBeInstanceOf(SubscriptionItemDeletionFieldsMissingError)
  })

  /**
   * A primeira exclusão depois de um deploy paga a ida à rede; as seguintes não —
   * é o que evita um round-trip a mais em toda exclusão só para confirmar algo que
   * já foi confirmado.
   */
  it('memoiza depois do primeiro sucesso — segunda chamada não consulta de novo', async () => {
    const mod = await import('./ensure-subscription-item-deletion-fields')
    const { bitrix, getCrmItemFields } = bitrixWithFields({
      [mod.SUBSCRIPTION_ITEM_DELETED_AT_FIELD]: { type: 'datetime' },
      [mod.SUBSCRIPTION_ITEM_DELETED_BY_FIELD]: { type: 'string' },
    })

    await mod.ensureSubscriptionItemDeletionFields(bitrix, 1146)
    await mod.ensureSubscriptionItemDeletionFields(bitrix, 1146)

    expect(getCrmItemFields).toHaveBeenCalledTimes(1)
  })

  /** Uma falha não é memoizada — a próxima tentativa reencontra o campo, se ele já existir. */
  it('não memoiza falha — tentativa seguinte consulta de novo', async () => {
    const mod = await import('./ensure-subscription-item-deletion-fields')
    const missing = bitrixWithFields({})

    await expect(
      mod.ensureSubscriptionItemDeletionFields(missing.bitrix, 1146),
    ).rejects.toBeInstanceOf(mod.SubscriptionItemDeletionFieldsMissingError)

    const nowPresent = bitrixWithFields({
      [mod.SUBSCRIPTION_ITEM_DELETED_AT_FIELD]: { type: 'datetime' },
      [mod.SUBSCRIPTION_ITEM_DELETED_BY_FIELD]: { type: 'string' },
    })

    await expect(
      mod.ensureSubscriptionItemDeletionFields(nowPresent.bitrix, 1146),
    ).resolves.toBeUndefined()
    expect(nowPresent.getCrmItemFields).toHaveBeenCalledTimes(1)
  })
})
