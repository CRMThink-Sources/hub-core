import { describe, expect, it, vi } from 'vitest'
import {
  BITRIX_ENTITY_TYPES,
  BITRIX_SPA_CLIENT_FIELDS as F,
} from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixSpaRepository } from './bitrix-spa.repository'

const KEY = { appId: 'crmthink.thinkzap', domain: 'acme.bitrix24.com.br' }

const filled = {
  id: 4242,
  [F.MEMBER_ID]: 'member-1',
  [F.NAME]: 'Joana Silva',
  [F.EMAIL]: 'joana@acme.com',
  [F.PHONE]: '5511999998888',
  [F.COMPANY]: 'Acme LTDA',
}

/** Item como ele nasce na instalação: só o e-mail, o resto vazio. */
const freshlyInstalled = {
  id: 4242,
  [F.MEMBER_ID]: 'member-1',
  [F.NAME]: '',
  [F.EMAIL]: 'admin@acme.com',
  [F.PHONE]: '',
  [F.COMPANY]: '',
}

function makeBitrix(item: Record<string, unknown> | null) {
  const listCrmItems = vi.fn(() =>
    Promise.resolve({ result: { items: item ? [item] : [] } }),
  )
  const getCrmItem = vi.fn(() => Promise.resolve({ result: { item } }))
  const updateCrmItem = vi.fn(() => Promise.resolve({ result: { id: '4242' } }))
  const createCrmItem = vi.fn(() =>
    Promise.resolve({ result: { item: { id: '4242' } } }),
  )

  const bitrix = {
    listCrmItems,
    getCrmItem,
    updateCrmItem,
    createCrmItem,
  } as unknown as BitrixClient

  return {
    repository: new BitrixSpaRepository(bitrix),
    listCrmItems,
    getCrmItem,
    updateCrmItem,
    createCrmItem,
  }
}

/** Os campos que o `crm.item.update` recebeu. */
function patchOf(updateCrmItem: {
  mock: { calls: unknown[][] }
}): Record<string, unknown> {
  const [call] = updateCrmItem.mock.calls
  if (!call) throw new Error('updateCrmItem não foi chamado')

  return call[2] as Record<string, unknown>
}

describe('BitrixSpaRepository', () => {
  describe('get', () => {
    it('lê os campos de contato e o member id do item', async () => {
      const { repository } = makeBitrix(filled)

      await expect(repository.get(KEY)).resolves.toMatchObject({
        id: '4242',
        memberId: 'member-1',
        name: 'Joana Silva',
        email: 'joana@acme.com',
        phone: '5511999998888',
        company: 'Acme LTDA',
      })
    })

    it('pede os campos no select — sem ele o Bitrix não devolve userfield', async () => {
      const { repository, listCrmItems } = makeBitrix(filled)

      await repository.get(KEY)

      const [, , options] = listCrmItems.mock.calls[0] as unknown as [
        unknown,
        unknown,
        { select: string[] },
      ]

      expect(options.select).toEqual(
        expect.arrayContaining([
          F.NAME,
          F.EMAIL,
          F.PHONE,
          F.COMPANY,
          F.MEMBER_ID,
        ]),
      )
    })

    it('devolve vazio nos campos que o item recém-instalado não tem', async () => {
      const { repository } = makeBitrix(freshlyInstalled)

      await expect(repository.get(KEY)).resolves.toMatchObject({
        email: 'admin@acme.com',
        memberId: 'member-1',
        name: '',
        phone: '',
        company: '',
      })
    })

    it('resolve campo nulo do Bitrix como string vazia, nunca null', async () => {
      const { repository } = makeBitrix({
        id: 4242,
        [F.NAME]: null,
        [F.EMAIL]: undefined,
        [F.PHONE]: null,
        [F.COMPANY]: null,
        [F.MEMBER_ID]: null,
      })

      await expect(repository.get(KEY)).resolves.toMatchObject({
        name: '',
        email: '',
        phone: '',
        company: '',
        memberId: '',
      })
    })

    it('devolve null quando o item não existe', async () => {
      const { repository } = makeBitrix(null)

      await expect(repository.get(KEY)).resolves.toBeNull()
    })
  })

  describe('update', () => {
    it('não envia campo de contato vazio, mantendo o valor do item', async () => {
      const { repository, updateCrmItem } = makeBitrix(filled)

      const result = await repository.update({
        ...KEY,
        email: 'admin@acme.com',
        name: '',
        phone: '',
        company: '',
      })

      const patch = patchOf(updateCrmItem)

      expect(patch).not.toHaveProperty(F.NAME)
      expect(patch).not.toHaveProperty(F.PHONE)
      expect(patch).not.toHaveProperty(F.COMPANY)

      // O retorno reflete o que ficou no CRM, não o `''` que foi pedido.
      expect(result).toMatchObject({
        name: 'Joana Silva',
        phone: '5511999998888',
        company: 'Acme LTDA',
      })
    })

    it('sobrescreve quando o valor recebido não é vazio', async () => {
      const { repository, updateCrmItem } = makeBitrix(filled)

      const result = await repository.update({
        ...KEY,
        name: 'Joana Souza',
      })

      expect(patchOf(updateCrmItem)).toMatchObject({
        [F.NAME]: 'Joana Souza',
      })
      expect(result).toMatchObject({ name: 'Joana Souza' })
    })

    it('não envia campo que não foi informado', async () => {
      const { repository, updateCrmItem } = makeBitrix(filled)

      await repository.update({ ...KEY, name: 'Joana Souza' })

      const patch = patchOf(updateCrmItem)

      expect(patch).not.toHaveProperty(F.EMAIL)
      expect(patch).not.toHaveProperty(F.PHONE)
      expect(patch).not.toHaveProperty(F.COMPANY)
      expect(patch).not.toHaveProperty(F.STATUS)
    })

    it('atualiza o e-mail quando ele vem preenchido', async () => {
      const { repository, updateCrmItem } = makeBitrix(filled)

      await repository.update({ ...KEY, email: 'novo@acme.com' })

      expect(patchOf(updateCrmItem)).toMatchObject({
        [F.EMAIL]: 'novo@acme.com',
      })
    })

    it('falha quando o item não existe, sem criar nada', async () => {
      const { repository, updateCrmItem, createCrmItem } = makeBitrix(null)

      await expect(
        repository.update({ ...KEY, name: 'Joana' }),
      ).rejects.toThrow('SPA not found to update')

      expect(updateCrmItem).not.toHaveBeenCalled()
      expect(createCrmItem).not.toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('escreve os campos de contato como recebidos, inclusive vazios', async () => {
      const { repository, createCrmItem } = makeBitrix(null)

      await repository.create({
        ...KEY,
        memberId: 'member-1',
        email: 'admin@acme.com',
        name: '',
        phone: '',
        company: '',
      })

      const [, fields] = createCrmItem.mock.calls[0] as unknown as [
        unknown,
        Record<string, unknown>,
      ]

      expect(fields[F.NAME]).toBe('')
      expect(fields[F.PHONE]).toBe('')
      expect(fields[F.COMPANY]).toBe('')
      expect(fields[F.EMAIL]).toBe('admin@acme.com')
    })
  })

  describe('getContact', () => {
    it('lê o contato por id do item, numa chamada e sem listagem', async () => {
      const { repository, getCrmItem, listCrmItems } = makeBitrix(filled)

      await expect(repository.getContact('4242')).resolves.toEqual({
        name: 'Joana Silva',
        email: 'joana@acme.com',
        phone: '5511999998888',
        company: 'Acme LTDA',
      })

      expect(getCrmItem).toHaveBeenCalledTimes(1)
      expect(getCrmItem).toHaveBeenCalledWith(
        BITRIX_ENTITY_TYPES.SPA_CLIENT,
        '4242',
      )
      expect(listCrmItems).not.toHaveBeenCalled()
    })
  })

  describe('updateContact', () => {
    it('escreve os quatro campos por id, sem busca prévia', async () => {
      const { repository, updateCrmItem, listCrmItems, getCrmItem } =
        makeBitrix(filled)

      await repository.updateContact('4242', {
        name: 'Joana Silva',
        email: 'joana@acme.com',
        phone: '5511999998888',
        company: 'Acme LTDA',
      })

      expect(updateCrmItem).toHaveBeenCalledTimes(1)
      expect(updateCrmItem).toHaveBeenCalledWith(
        BITRIX_ENTITY_TYPES.SPA_CLIENT,
        '4242',
        {
          [F.NAME]: 'Joana Silva',
          [F.EMAIL]: 'joana@acme.com',
          [F.PHONE]: '5511999998888',
          [F.COMPANY]: 'Acme LTDA',
        },
      )
      expect(listCrmItems).not.toHaveBeenCalled()
      expect(getCrmItem).not.toHaveBeenCalled()
    })

    it('não cria item quando o id não existe — o Bitrix recusa e o erro sobe', async () => {
      const { repository, createCrmItem } = makeBitrix(filled)
      const bitrix = {
        updateCrmItem: vi.fn(() => Promise.reject(new Error('not found'))),
        createCrmItem,
      } as unknown as BitrixClient

      await expect(
        new BitrixSpaRepository(bitrix).updateContact('9999', {
          name: 'Joana',
          email: 'joana@acme.com',
          phone: '5511999998888',
          company: 'Acme',
        }),
      ).rejects.toThrow('not found')

      expect(createCrmItem).not.toHaveBeenCalled()
    })
  })
})
