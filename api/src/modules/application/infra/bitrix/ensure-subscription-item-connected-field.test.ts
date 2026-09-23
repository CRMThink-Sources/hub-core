import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

const bitrixWithFields = (fields: Record<string, { type?: string }>) => {
  const getCrmItemFields = vi.fn().mockResolvedValue({ result: { fields } })
  return {
    bitrix: { getCrmItemFields } as unknown as BitrixClient,
    getCrmItemFields,
  }
}

/** Guard e erros do mesmo grafo de módulos — `resetModules` recria as classes. */
const load = async () => ({
  ...(await import('./ensure-subscription-item-connected-field')),
  ...(await import('./ensure-spa-text-field')),
})

/** `vi.resetModules`: o guard memoiza em variável de módulo. */
describe('ensureSubscriptionItemConnectedField', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('passa quando o campo existe como texto', async () => {
    const { ensureSubscriptionItemConnectedField } = await load()
    const { bitrix } = bitrixWithFields({
      ufCrm93Connected: { type: 'string' },
    })

    await expect(
      ensureSubscriptionItemConnectedField(bitrix, 1146),
    ).resolves.toBeUndefined()
  })

  it('falha quando o campo não existe', async () => {
    const { ensureSubscriptionItemConnectedField, SpaTextFieldMissingError } =
      await load()
    const { bitrix } = bitrixWithFields({})

    await expect(
      ensureSubscriptionItemConnectedField(bitrix, 1146),
    ).rejects.toBeInstanceOf(SpaTextFieldMissingError)
  })

  it('falha quando o campo é lista', async () => {
    const {
      ensureSubscriptionItemConnectedField,
      SpaTextFieldIsEnumerationError,
    } = await load()
    const { bitrix } = bitrixWithFields({
      ufCrm93Connected: { type: 'enumeration' },
    })

    await expect(
      ensureSubscriptionItemConnectedField(bitrix, 1146),
    ).rejects.toBeInstanceOf(SpaTextFieldIsEnumerationError)
  })

  it('memoiza o sucesso e não a falha', async () => {
    const { ensureSubscriptionItemConnectedField, SpaTextFieldMissingError } =
      await load()
    const getCrmItemFields = vi
      .fn()
      .mockResolvedValueOnce({ result: { fields: {} } })
      .mockResolvedValue({
        result: { fields: { ufCrm93Connected: { type: 'string' } } },
      })
    const bitrix = { getCrmItemFields } as unknown as BitrixClient

    await expect(
      ensureSubscriptionItemConnectedField(bitrix, 1146),
    ).rejects.toBeInstanceOf(SpaTextFieldMissingError)
    await ensureSubscriptionItemConnectedField(bitrix, 1146)
    await ensureSubscriptionItemConnectedField(bitrix, 1146)

    expect(getCrmItemFields).toHaveBeenCalledTimes(2)
  })
})
