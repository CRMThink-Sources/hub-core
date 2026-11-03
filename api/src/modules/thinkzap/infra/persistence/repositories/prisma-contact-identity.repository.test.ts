import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock, findUniqueMock, updateManyMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateManyMock: vi.fn(),
}))

vi.mock('@/config/prisma', () => ({
  prisma: {
    thinkzapContactIdentity: {
      upsert: upsertMock,
      findUnique: findUniqueMock,
      updateMany: updateManyMock,
    },
  },
}))

import { PrismaContactIdentityRepository } from './prisma-contact-identity.repository'

const sut = () => new PrismaContactIdentityRepository()

type UpsertArgs = {
  where: Record<string, unknown>
  create: Record<string, unknown>
  update: Record<string, unknown>
}

const upsertArgs = (): UpsertArgs => upsertMock.mock.calls[0]?.[0] as UpsertArgs

describe('PrismaContactIdentityRepository', () => {
  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue(undefined)
    findUniqueMock.mockReset().mockResolvedValue(null)
    updateManyMock.mockReset().mockResolvedValue({ count: 1 })
  })

  it('busca por lid usando a unique escopada por instância', async () => {
    findUniqueMock.mockResolvedValue({
      instanceId: 'INST-A',
      lid: '357@lid',
      phone: '5547992259475',
      legacyPhoneIdentity: null,
    })

    const found = await sut().findByLid('INST-A', '357@lid')

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        uq_identity_instance_lid: { instanceId: 'INST-A', lid: '357@lid' },
      },
    })
    expect(found).toEqual({
      instanceId: 'INST-A',
      lid: '357@lid',
      phone: '5547992259475',
      legacyPhoneIdentity: null,
    })
  })

  it('busca por telefone usando a unique escopada por instância', async () => {
    await sut().findByPhone('INST-A', '5547992259475')

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        uq_identity_instance_phone: {
          instanceId: 'INST-A',
          phone: '5547992259475',
        },
      },
    })
  })

  it('devolve null quando não há row', async () => {
    expect(await sut().findByLid('INST-A', '357@lid')).toBeNull()
  })

  it('grava o par com a chave no lid, não no telefone', async () => {
    await sut().upsertPair({
      instanceId: 'INST-A',
      lid: '357@lid',
      phone: '5547992259475',
    })

    expect(upsertArgs().where).toEqual({
      uq_identity_instance_lid: { instanceId: 'INST-A', lid: '357@lid' },
    })
    expect(upsertArgs().create).toMatchObject({
      instanceId: 'INST-A',
      lid: '357@lid',
      phone: '5547992259475',
    })
  })

  /**
   * O contato lid-only é o caso permanente, não transitório: `lid` → telefone é
   * impossível, então essa row nasce sem telefone e pode morrer sem telefone.
   */
  it('aceita contato lid-only, sem telefone', async () => {
    await sut().upsertPair({ instanceId: 'INST-A', lid: '357@lid' })

    expect(upsertArgs().create).toMatchObject({ phone: null })
  })

  /**
   * Sem esta condição, um evento lid-only chegando depois de um evento com número
   * gravaria `null` por cima — e o mapa esqueceria justamente o que existe para
   * lembrar, sem caminho de recuperação.
   */
  it('evento sem telefone não apaga o telefone já conhecido', async () => {
    await sut().upsertPair({ instanceId: 'INST-A', lid: '357@lid' })

    expect(upsertArgs().update).toEqual({})
  })

  it('evento com telefone atualiza o telefone', async () => {
    await sut().upsertPair({
      instanceId: 'INST-A',
      lid: '357@lid',
      phone: '5547992259475',
    })

    expect(upsertArgs().update).toEqual({ phone: '5547992259475' })
  })

  /**
   * `legacyPhoneIdentity` é coluna do backfill. Se o runtime a escrevesse, um contato
   * novo viraria legado e ficaria preso a uma identidade de telefone que nunca teve
   * sessão nenhuma no Bitrix.
   */
  it('nunca escreve identidade legada', async () => {
    await sut().upsertPair({
      instanceId: 'INST-A',
      lid: '357@lid',
      phone: '5547992259475',
    })

    expect(upsertArgs().create).not.toHaveProperty('legacyPhoneIdentity')
    expect(upsertArgs().update).not.toHaveProperty('legacyPhoneIdentity')
  })

  describe('pinLegacyIdentity', () => {
    const input = {
      instanceId: 'INST-A',
      lid: '357@lid',
      chatId: '5547984050811',
    }

    it('grava quando a identidade legada está vazia', async () => {
      findUniqueMock.mockResolvedValue({ lid: '357@lid' })

      await expect(sut().pinLegacyIdentity(input)).resolves.toBe(true)

      expect(updateManyMock).toHaveBeenCalledWith({
        where: {
          instanceId: 'INST-A',
          lid: '357@lid',
          legacyPhoneIdentity: null,
        },
        data: { legacyPhoneIdentity: '5547984050811' },
      })
      expect(upsertMock).not.toHaveBeenCalled()
    })

    it('não sobrescreve identidade já fixada', async () => {
      findUniqueMock.mockResolvedValue({ lid: '357@lid' })
      updateManyMock.mockResolvedValue({ count: 0 })

      await expect(sut().pinLegacyIdentity(input)).resolves.toBe(false)
    })

    it('cria a row do LID quando ela ainda não existe', async () => {
      await sut().pinLegacyIdentity(input)

      expect(upsertArgs().create).toMatchObject({
        instanceId: 'INST-A',
        lid: '357@lid',
        phone: null,
      })
      expect(upsertArgs().create).not.toHaveProperty('legacyPhoneIdentity')
      expect(updateManyMock).toHaveBeenCalledTimes(1)
    })
  })
})
