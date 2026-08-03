import { describe, expect, it, vi } from 'vitest'
import {
  CustomerPrismaClient,
  PrismaCustomerRepository,
} from './prisma-customers.repository'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { Product } from '@/modules/application/domain/entities/product'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'

const domainRow = {
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
}

const customer = {
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
}

const productOf = (id: string): Product => ({
  id,
  name: `Produto ${id}`,
  billingModel: 'subscription',
  active: true,
})

const aplicationOf = (id: string, spaId: string | null): Aplication => ({
  id,
  spaId,
  customer,
  appCode: `app-code-${id}`,
  title: `App ${id}`,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
})

const subscriptionOf = (
  id: string,
  productId: string,
  planId = '7',
  status: Subscription['status'] = 'active',
): Subscription => ({
  id,
  name: `Assinatura ${id}`,
  plan: {
    id: planId,
    name: `Plano ${planId}`,
    product: productOf(productId),
    amount: 4990,
    interval: 'monthly',
    active: true,
  },
  status,
  currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  aplication: aplicationOf('app-1', '512'),
})

function makePrisma(row: typeof domainRow | null, all = [domainRow]) {
  const findUnique = vi.fn(() => Promise.resolve(row))
  const findMany = vi.fn(() => Promise.resolve(all))

  const prisma = {
    domain: { findUnique, findMany },
  } as unknown as CustomerPrismaClient

  return { prisma, findUnique, findMany }
}

function makeAplications(aplications: Aplication[]) {
  const getAplicationsByCustomer = vi.fn(() => Promise.resolve(aplications))

  const repository = {
    getAplicationsByCustomer,
  } as unknown as AplicationRepository

  return { repository, getAplicationsByCustomer }
}

/** Devolve as assinaturas registradas por `spaId`. */
function makeSubscriptions(bySpaId: Record<string, Subscription[]>) {
  const getSubscriptionsByAplication = vi.fn((spaId: string) =>
    Promise.resolve(bySpaId[spaId] ?? []),
  )

  const repository = {
    getSubscriptionsByAplication,
  } as unknown as SubscriptionRepository

  return { repository, getSubscriptionsByAplication }
}

describe('PrismaCustomerRepository', () => {
  describe('leitura', () => {
    it('devolve o cliente de core_domains', async () => {
      const { prisma, findUnique } = makePrisma(domainRow)

      const result = await new PrismaCustomerRepository(
        prisma,
        makeAplications([]).repository,
        makeSubscriptions({}).repository,
      ).getCustomer('domain-1')

      expect(result).toEqual(customer)
      expect(findUnique).toHaveBeenCalledWith({ where: { id: 'domain-1' } })
    })

    it('lança CustomerNotFoundError quando não há linha', async () => {
      const { prisma } = makePrisma(null)

      await expect(
        new PrismaCustomerRepository(
          prisma,
          makeAplications([]).repository,
          makeSubscriptions({}).repository,
        ).getCustomer('ausente'),
      ).rejects.toThrow(CustomerNotFoundError)
    })

    it('lista os clientes', async () => {
      const { prisma } = makePrisma(domainRow, [
        domainRow,
        { id: 'domain-2', name: 'outro.bitrix24.com.br', memberId: 'member-2' },
      ])

      const result = await new PrismaCustomerRepository(
        prisma,
        makeAplications([]).repository,
        makeSubscriptions({}).repository,
      ).getCustomers()

      expect(result.map(item => item.id)).toEqual(['domain-1', 'domain-2'])
    })

    it('devolve lista vazia quando não há portal registrado', async () => {
      const { prisma } = makePrisma(null, [])

      const result = await new PrismaCustomerRepository(
        prisma,
        makeAplications([]).repository,
        makeSubscriptions({}).repository,
      ).getCustomers()

      expect(result).toEqual([])
    })
  })

  describe('lookups', () => {
    it('resolve por member id', async () => {
      const { prisma, findUnique } = makePrisma(domainRow)

      const result = await new PrismaCustomerRepository(
        prisma,
        makeAplications([]).repository,
        makeSubscriptions({}).repository,
      ).getCustomerByMemberId('member-1')

      expect(result).toEqual(customer)
      expect(findUnique).toHaveBeenCalledWith({
        where: { memberId: 'member-1' },
      })
    })

    it('resolve por nome do portal', async () => {
      const { prisma, findUnique } = makePrisma(domainRow)

      const result = await new PrismaCustomerRepository(
        prisma,
        makeAplications([]).repository,
        makeSubscriptions({}).repository,
      ).getCustomerByName('acme.bitrix24.com.br')

      expect(result).toEqual(customer)
      expect(findUnique).toHaveBeenCalledWith({
        where: { name: 'acme.bitrix24.com.br' },
      })
    })

    it.each([
      ['getCustomerByMemberId', 'member-ausente'],
      ['getCustomerByName', 'ausente.bitrix24.com.br'],
    ] as const)(
      'devolve null em %s sem correspondência',
      async (method, arg) => {
        const { prisma } = makePrisma(null)
        const repository = new PrismaCustomerRepository(
          prisma,
          makeAplications([]).repository,
          makeSubscriptions({}).repository,
        )

        await expect(repository[method](arg)).resolves.toBeNull()
      },
    )
  })

  describe('getCustomerProducts', () => {
    it('agrupa por produto da assinatura', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([aplicationOf('app-1', '512')])
      const subscriptions = makeSubscriptions({
        '512': [subscriptionOf('1', '42'), subscriptionOf('2', '77')],
      })

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(result.map(group => group.product.id)).toEqual(['42', '77'])
      expect(result.map(group => group.subscriptions.length)).toEqual([1, 1])
    })

    it('junta assinaturas do mesmo produto num grupo só', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([aplicationOf('app-1', '512')])
      const subscriptions = makeSubscriptions({
        '512': [subscriptionOf('1', '42', '7'), subscriptionOf('2', '42', '8')],
      })

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.subscriptions.map(item => item.plan.id)).toEqual([
        '7',
        '8',
      ])
    })

    it('consulta uma vez por aplicação com espelho', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([
        aplicationOf('app-1', '512'),
        aplicationOf('app-2', '900'),
      ])
      const subscriptions = makeSubscriptions({
        '512': [subscriptionOf('1', '42')],
        '900': [subscriptionOf('2', '77')],
      })

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(subscriptions.getSubscriptionsByAplication).toHaveBeenCalledTimes(
        2,
      )
      expect(result.map(group => group.product.id)).toEqual(['42', '77'])
    })

    it('ignora aplicação sem espelho na SPA', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([
        aplicationOf('app-1', null),
        aplicationOf('app-2', '900'),
      ])
      const subscriptions = makeSubscriptions({
        '900': [subscriptionOf('2', '77')],
      })

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(subscriptions.getSubscriptionsByAplication).toHaveBeenCalledTimes(
        1,
      )
      expect(subscriptions.getSubscriptionsByAplication).toHaveBeenCalledWith(
        '900',
      )
      expect(result.map(group => group.product.id)).toEqual(['77'])
    })

    it('devolve vazio sem tocar em assinatura quando o cliente não tem aplicação', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([])
      const subscriptions = makeSubscriptions({})

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(result).toEqual([])
      expect(subscriptions.getSubscriptionsByAplication).not.toHaveBeenCalled()
    })

    it('devolve vazio quando todas as aplicações estão sem espelho', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([aplicationOf('app-1', null)])
      const subscriptions = makeSubscriptions({})

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(result).toEqual([])
      expect(subscriptions.getSubscriptionsByAplication).not.toHaveBeenCalled()
    })

    it('devolve vazio quando as aplicações não têm assinatura', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([aplicationOf('app-1', '512')])
      const subscriptions = makeSubscriptions({})

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(result).toEqual([])
    })

    it('inclui assinatura cancelada — filtrar é de quem consome', async () => {
      const { prisma } = makePrisma(domainRow)
      const aplications = makeAplications([aplicationOf('app-1', '512')])
      const subscriptions = makeSubscriptions({
        '512': [subscriptionOf('1', '42', '7', 'cancelled')],
      })

      const result = await new PrismaCustomerRepository(
        prisma,
        aplications.repository,
        subscriptions.repository,
      ).getCustomerProducts('domain-1')

      expect(result[0]?.subscriptions[0]?.status).toBe('cancelled')
    })

    it('lança CustomerNotFoundError em vez de devolver vazio para cliente inexistente', async () => {
      const { prisma } = makePrisma(null)
      const aplications = makeAplications([])

      await expect(
        new PrismaCustomerRepository(
          prisma,
          aplications.repository,
          makeSubscriptions({}).repository,
        ).getCustomerProducts('ausente'),
      ).rejects.toThrow(CustomerNotFoundError)
      expect(aplications.getAplicationsByCustomer).not.toHaveBeenCalled()
    })
  })
})
