import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import { BitrixSubscriptionItemRepository } from './bitrix-subscription-items.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { SubscriptionItemNotFoundError } from '@/modules/application/domain/errors/subscription-item-not-found.error'
import { SubscriptionNotFoundError } from '@/modules/application/domain/errors/subscription-not-found.error'
import { InvalidBitrixSubscriptionItemError } from '../errors/invalid-bitrix-subscription-item.error'
import { SUBSCRIPTION_PARENT_FIELD } from '../mappers/subscription-item.mapper'
import { env } from '@/config/env'

const spaItem = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Conector ${id}`,
  [SUBSCRIPTION_PARENT_FIELD]: 4242,
  ufCrm93Status: '13625',
  ...overrides,
})

const makeBitrix = (overrides: Record<string, unknown>) =>
  overrides as unknown as BitrixClient

const makeRepository = (bitrix: BitrixClient) =>
  new BitrixSubscriptionItemRepository(bitrix)

describe('BitrixSubscriptionItemRepository', () => {
  describe('getSubscriptionItem', () => {
    it('lê o item na SPA de itens e mapeia', async () => {
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: spaItem(555) } }),
      )

      const item = await makeRepository(
        makeBitrix({ getCrmItem }),
      ).getSubscriptionItem('555')

      expect(getCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        '555',
      )
      expect(item).toEqual({
        id: '555',
        name: 'Conector 555',
        subscription: '4242',
        status: 'active',
        metadata: { provider: 'NONE' },
        settings: DEFAULT_CONNECTOR_SETTINGS,
        vinculatedChannel: null,
        gatewayId: undefined,
      })
    })

    it('lança SubscriptionItemNotFoundError quando o Bitrix não devolve o item', async () => {
      const bitrix = makeBitrix({
        getCrmItem: vi.fn(() => Promise.resolve({ result: {} })),
      })

      await expect(
        makeRepository(bitrix).getSubscriptionItem('999'),
      ).rejects.toThrow(SubscriptionItemNotFoundError)
    })
  })

  describe('getSubscriptionItems', () => {
    it('lista sem filtro, numa chamada só', async () => {
      const listCrmItems = vi.fn(() =>
        Promise.resolve({ result: { items: [spaItem(1), spaItem(2)] } }),
      )

      const items = await makeRepository(
        makeBitrix({ listCrmItems }),
      ).getSubscriptionItems()

      expect(listCrmItems).toHaveBeenCalledTimes(1)
      expect(listCrmItems).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        {},
      )
      expect(items.map(item => item.id)).toEqual(['1', '2'])
    })

    it('devolve [] quando result.items vem ausente', async () => {
      const bitrix = makeBitrix({
        listCrmItems: vi.fn(() => Promise.resolve({ result: {} })),
      })

      await expect(
        makeRepository(bitrix).getSubscriptionItems(),
      ).resolves.toEqual([])
    })

    it('propaga o erro de um item inválido em vez de omiti-lo', async () => {
      const bitrix = makeBitrix({
        listCrmItems: vi.fn(() =>
          Promise.resolve({
            result: {
              items: [spaItem(1), spaItem(2, { ufCrm93Status: '13999' })],
            },
          }),
        ),
      })

      await expect(
        makeRepository(bitrix).getSubscriptionItems(),
      ).rejects.toThrow(InvalidBitrixSubscriptionItemError)
    })
  })

  describe('getSubscriptionItemsBySubscription', () => {
    it('filtra pelo campo parent derivado do env', async () => {
      const listCrmItems = vi.fn(() =>
        Promise.resolve({ result: { items: [spaItem(7)] } }),
      )

      const items = await makeRepository(
        makeBitrix({ listCrmItems }),
      ).getSubscriptionItemsBySubscription('4242')

      expect(listCrmItems).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        { parentId1142: '4242' },
      )
      expect(items).toHaveLength(1)
    })

    it('devolve [] quando a assinatura não tem item', async () => {
      const bitrix = makeBitrix({
        listCrmItems: vi.fn(() => Promise.resolve({ result: { items: [] } })),
      })

      await expect(
        makeRepository(bitrix).getSubscriptionItemsBySubscription('4242'),
      ).resolves.toEqual([])
    })
  })

  describe('createSubscriptionItem', () => {
    it('cria e relê o item pelo id devolvido', async () => {
      const createCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: { id: 77 } } }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: spaItem(77) } }),
      )

      const item = await makeRepository(
        makeBitrix({ createCrmItem, getCrmItem }),
      ).createSubscriptionItem({
        name: 'Conector novo',
        subscription: '4242',
        status: 'active',
        metadata: { provider: 'NONE' },
      })

      expect(createCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        expect.objectContaining({
          title: 'Conector novo',
          parentId1142: '4242',
          ufCrm93Status: '13625',
        }),
      )
      expect(getCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        '77',
      )
      expect(item.id).toBe('77')
    })

    it('grava os defaults de settings quando o input não os traz', async () => {
      const createCrmItem = vi.fn(
        (_entityTypeId: number, _fields: Record<string, unknown>) =>
          Promise.resolve({ result: { item: { id: 77 } } }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: spaItem(77) } }),
      )

      await makeRepository(
        makeBitrix({ createCrmItem, getCrmItem }),
      ).createSubscriptionItem({
        name: 'Conector novo',
        subscription: '4242',
        status: 'active',
        metadata: { provider: 'NONE' },
      })

      expect(createCrmItem.mock.calls[0]?.[1]).toMatchObject({
        ufCrm93Settings: JSON.stringify(DEFAULT_CONNECTOR_SETTINGS),
      })
    })

    it('respeita settings informado no input', async () => {
      const createCrmItem = vi.fn(
        (_entityTypeId: number, _fields: Record<string, unknown>) =>
          Promise.resolve({ result: { item: { id: 77 } } }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: spaItem(77) } }),
      )
      const settings = {
        ...DEFAULT_CONNECTOR_SETTINGS,
        prefixOperatorNameEnabled: true,
      }

      await makeRepository(
        makeBitrix({ createCrmItem, getCrmItem }),
      ).createSubscriptionItem({
        name: 'Conector novo',
        subscription: '4242',
        status: 'active',
        metadata: { provider: 'NONE' },
        settings,
      })

      expect(createCrmItem.mock.calls[0]?.[1]).toMatchObject({
        ufCrm93Settings: JSON.stringify(settings),
      })
    })

    it('lança quando crm.item.add não devolve id', async () => {
      const bitrix = makeBitrix({
        createCrmItem: vi.fn(() => Promise.resolve({ result: {} })),
      })

      await expect(
        makeRepository(bitrix).createSubscriptionItem({
          name: 'Conector novo',
          subscription: '4242',
          status: 'active',
          metadata: { provider: 'NONE' },
        }),
      ).rejects.toThrow(/não devolveu o id/)
    })
  })

  describe('updateSubscriptionItem', () => {
    it('aplica o patch e relê o item', async () => {
      const updateCrmItem = vi.fn(() => Promise.resolve({ result: {} }))
      const getCrmItem = vi.fn(() =>
        Promise.resolve({
          result: { item: spaItem(77, { ufCrm93Status: '13627' }) },
        }),
      )

      const item = await makeRepository(
        makeBitrix({ updateCrmItem, getCrmItem }),
      ).updateSubscriptionItem('77', { status: 'cancelled' })

      expect(updateCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        '77',
        { ufCrm93Status: '13627' },
      )
      expect(item.status).toBe('cancelled')
    })

    it('não emite o campo parent no patch', async () => {
      const updateCrmItem = vi.fn(
        (
          _entityTypeId: number,
          _id: string,
          _fields: Record<string, unknown>,
        ) => Promise.resolve({ result: {} }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: spaItem(77) } }),
      )

      await makeRepository(
        makeBitrix({ updateCrmItem, getCrmItem }),
      ).updateSubscriptionItem('77', { name: 'Renomeado' })

      expect(updateCrmItem.mock.calls[0]?.[2]).not.toHaveProperty(
        SUBSCRIPTION_PARENT_FIELD,
      )
    })

    /**
     * Verificação de **tipo**, não de runtime: é a incapacidade do patch de
     * carregar `subscription` que garante que ninguém move item por acidente. Um
     * `@ts-expect-error` que deixasse de errar reprovaria o typecheck, então esta
     * linha é o teste.
     */
    it('não aceita subscription no tipo de patch, e descarta a chave em runtime', async () => {
      const updateCrmItem = vi.fn(
        (
          _entityTypeId: number,
          _id: string,
          _fields: Record<string, unknown>,
        ) => Promise.resolve({ result: {} }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: spaItem(77) } }),
      )

      await makeRepository(
        makeBitrix({ updateCrmItem, getCrmItem }),
      ).updateSubscriptionItem(
        '77',
        // @ts-expect-error mover item é `reparentSubscriptionItem`, não patch
        { subscription: '9999' },
      )

      expect(updateCrmItem.mock.calls[0]?.[2]).not.toHaveProperty(
        SUBSCRIPTION_PARENT_FIELD,
      )
    })
  })

  describe('reparentSubscriptionItem', () => {
    /** `getCrmItem` que responde por SPA: 1142 é a assinatura, 1146 é o item. */
    const makeGetCrmItem = (options: { subscriptionExists: boolean }) =>
      vi.fn((entityTypeId: number, id: string) => {
        if (entityTypeId === env.payments.spa.subscriptionEntityType) {
          return Promise.resolve(
            options.subscriptionExists
              ? { result: { item: { id } } }
              : { result: {} },
          )
        }
        return Promise.resolve({
          result: { item: spaItem(77, { [SUBSCRIPTION_PARENT_FIELD]: 9999 }) },
        })
      })

    it('troca o pai e devolve a entidade relida', async () => {
      const updateCrmItem = vi.fn(
        (
          _entityTypeId: number,
          _id: string,
          _fields: Record<string, unknown>,
        ) => Promise.resolve({ result: {} }),
      )
      const getCrmItem = makeGetCrmItem({ subscriptionExists: true })

      const item = await makeRepository(
        makeBitrix({ updateCrmItem, getCrmItem }),
      ).reparentSubscriptionItem('77', '9999')

      expect(updateCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionItemEntityType,
        '77',
        { [SUBSCRIPTION_PARENT_FIELD]: '9999' },
      )
      expect(item.subscription).toBe('9999')
    })

    /**
     * Credencial, `settings` e `vinculatedChannel` são a linha do cliente: uma
     * operação de cobrança não os toca. Um campo a mais aqui é o que apagaria o
     * conector de quem acabou de pagar.
     */
    it('envia apenas o campo parent, e nada mais', async () => {
      const updateCrmItem = vi.fn(
        (
          _entityTypeId: number,
          _id: string,
          _fields: Record<string, unknown>,
        ) => Promise.resolve({ result: {} }),
      )
      const getCrmItem = makeGetCrmItem({ subscriptionExists: true })

      await makeRepository(
        makeBitrix({ updateCrmItem, getCrmItem }),
      ).reparentSubscriptionItem('77', '9999')

      expect(Object.keys(updateCrmItem.mock.calls[0]?.[2] ?? {})).toEqual([
        SUBSCRIPTION_PARENT_FIELD,
      ])
    })

    it('verifica o destino antes de escrever', async () => {
      const updateCrmItem = vi.fn(() => Promise.resolve({ result: {} }))
      const getCrmItem = makeGetCrmItem({ subscriptionExists: false })

      await expect(
        makeRepository(
          makeBitrix({ updateCrmItem, getCrmItem }),
        ).reparentSubscriptionItem('77', '9999'),
      ).rejects.toThrow(SubscriptionNotFoundError)

      // O item permanece onde estava: nenhuma escrita aconteceu.
      expect(updateCrmItem).not.toHaveBeenCalled()
    })
  })
})
