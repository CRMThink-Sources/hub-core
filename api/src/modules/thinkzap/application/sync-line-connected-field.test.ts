import { describe, expect, it, vi } from 'vitest'
import { SyncLineConnectedField } from './sync-line-connected-field'

const makeSut = () => {
  const updateSubscriptionItem = vi.fn().mockResolvedValue({})
  const ensureField = vi.fn().mockResolvedValue(undefined)
  return {
    sut: new SyncLineConnectedField({ updateSubscriptionItem }, ensureField),
    updateSubscriptionItem,
    ensureField,
  }
}

describe('SyncLineConnectedField', () => {
  it.each([
    [null, true],
    [null, false],
    [false, true],
    [true, false],
  ])('grava quando o valor muda (%s → %s)', async (current, connected) => {
    const { sut, updateSubscriptionItem, ensureField } = makeSut()

    await expect(
      sut.execute({ itemId: '7', current, connected }),
    ).resolves.toBe('written')
    expect(ensureField).toHaveBeenCalledOnce()
    expect(updateSubscriptionItem).toHaveBeenCalledWith('7', { connected })
  })

  it.each([true, false])(
    'não escreve quando o valor já é %s',
    async connected => {
      const { sut, updateSubscriptionItem, ensureField } = makeSut()

      await expect(
        sut.execute({ itemId: '7', current: connected, connected }),
      ).resolves.toBe('unchanged')
      expect(updateSubscriptionItem).not.toHaveBeenCalled()
      expect(ensureField).not.toHaveBeenCalled()
    },
  )

  it('não escreve quando o campo não existe', async () => {
    const { sut, updateSubscriptionItem, ensureField } = makeSut()
    ensureField.mockRejectedValueOnce(new Error('campo ausente'))

    await expect(
      sut.execute({ itemId: '7', current: null, connected: true }),
    ).rejects.toThrow('campo ausente')
    expect(updateSubscriptionItem).not.toHaveBeenCalled()
  })
})
