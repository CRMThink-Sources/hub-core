import { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { GetAplicationContextController } from './get-aplication-context.controller'
import {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { Customer } from '@/modules/application/domain/entities/customer'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { InvalidBitrixSubscriptionItemError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription-item.error'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'

const customer: Customer = {
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
}

const aplication: Aplication = {
  id: 'app-1',
  spaId: '512',
  customer,
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Acme',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
}

const context: AplicationContext = {
  customer,
  aplication,
  subscriptions: [],
}

const makeUseCase = (result: AplicationContext | Error = context) => {
  const execute = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  )

  return {
    useCase: { execute } as unknown as GetAplicationContext,
    execute,
  }
}

const makeRequest = (overrides: Partial<Request> = {}) =>
  ({
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
    ...overrides,
  }) as unknown as Request

const response = {} as unknown as Response

describe('GetAplicationContextController', () => {
  it('devolve 200 com o payload serializado', async () => {
    const { useCase, execute } = makeUseCase()

    const result = await new GetAplicationContextController(useCase).perform(
      makeRequest(),
      response,
    )

    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
    expect(result.status).toBe(200)
    expect(result.result).toEqual({
      customer,
      aplication: {
        id: 'app-1',
        spaId: '512',
        appCode: 'crmthink.thinkzap',
        title: 'ThinkZap — Acme',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      subscriptions: [],
    })
  })

  it('omite assinaturas canceladas e mantém as demais', async () => {
    const subscriptionWith = (
      id: string,
      status: SubscriptionWithItems['status'],
    ): SubscriptionWithItems => ({
      id,
      name: `Assinatura ${id}`,
      plan: {
        id: '7',
        name: 'ThinkZap Pro',
        product: {
          id: '42',
          name: 'ThinkZap',
          billingModel: 'subscription',
          active: true,
        },
        amount: 4990,
        interval: 'monthly',
        active: true,
      },
      status,
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      aplication,
      modality: 'stripe',
      items: [],
    })

    const { useCase } = makeUseCase({
      ...context,
      subscriptions: [
        subscriptionWith('1', 'cancelled'),
        subscriptionWith('2', 'active'),
        subscriptionWith('3', 'trialing'),
        subscriptionWith('4', 'trial_expired'),
        subscriptionWith('5', 'past_due'),
      ],
    })

    const result = await new GetAplicationContextController(useCase).perform(
      makeRequest(),
      response,
    )

    expect(result.status).toBe(200)
    expect(
      (result.result as { subscriptions: { id: string }[] }).subscriptions.map(
        s => s.id,
      ),
    ).toEqual(['2', '3', '4', '5'])
  })

  describe('validação da entrada vinda do JWT', () => {
    it.each([['domainId'], ['appId']])(
      'rejeita quando %s não foi populado pelo middleware',
      async field => {
        const { useCase, execute } = makeUseCase()

        await expect(
          new GetAplicationContextController(useCase).perform(
            makeRequest({ [field]: undefined }),
            response,
          ),
        ).rejects.toThrow(ZodError)
        expect(execute).not.toHaveBeenCalled()
      },
    )
  })

  describe('erros', () => {
    it('traduz AplicationNotFoundError para 404', async () => {
      const { useCase } = makeUseCase(
        new AplicationNotFoundError('crmthink.thinkzap'),
      )

      const result = await new GetAplicationContextController(useCase).perform(
        makeRequest(),
        response,
      )

      expect(result.status).toBe(404)
    })

    it('traduz CustomerNotFoundError para 404', async () => {
      const { useCase } = makeUseCase(new CustomerNotFoundError('domain-1'))

      const result = await new GetAplicationContextController(useCase).perform(
        makeRequest(),
        response,
      )

      expect(result.status).toBe(404)
    })

    it('traduz falha do Bitrix para 502, sem payload parcial', async () => {
      const { useCase } = makeUseCase(
        new BitrixError('Failed to list CRM items'),
      )

      const result = await new GetAplicationContextController(useCase).perform(
        makeRequest(),
        response,
      )

      expect(result.status).toBe(502)
      expect(result.result).not.toHaveProperty('subscriptions')
      expect(result.result).not.toHaveProperty('customer')
    })

    it('traduz item inválido na SPA para 502', async () => {
      const { useCase } = makeUseCase(
        new InvalidBitrixSubscriptionItemError([]),
      )

      const result = await new GetAplicationContextController(useCase).perform(
        makeRequest(),
        response,
      )

      expect(result.status).toBe(502)
    })

    it('propaga erro desconhecido para a classe base tratar como 500', async () => {
      const { useCase } = makeUseCase(new Error('boom'))

      await expect(
        new GetAplicationContextController(useCase).perform(
          makeRequest(),
          response,
        ),
      ).rejects.toThrow('boom')
    })
  })
})
