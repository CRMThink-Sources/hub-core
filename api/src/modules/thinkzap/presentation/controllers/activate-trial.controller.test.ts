/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import type Stripe from 'stripe'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

vi.mock('@/config/env', () => ({
  env: {
    thinkzapStripePriceId: 'price_zapi',
    hubmessageStripePriceId: 'price_hub',
    stripe: { secretKey: 'sk_test' },
    crmthinkWebhookUrl: '',
    // Campos lidos pelo logger (Controller base).
    logLevel: 'silent',
    lokiUrl: '',
    nodeEnv: 'test',
  },
}))

const provisionMock = vi.fn().mockResolvedValue({ created: 1 })
vi.mock('@/modules/thinkzap/application/provision-missing-connectors', () => ({
  provisionMissingConnectorsForProvider: (...args: unknown[]) =>
    provisionMock(...args),
}))

import { ActivateTrialController } from './activate-trial.controller'

function makeStripe(overrides: Record<string, unknown> = {}) {
  return {
    customers: {
      list: vi.fn().mockResolvedValue({ data: [{ id: 'cus_1' }] }),
      create: vi.fn().mockResolvedValue({ id: 'cus_new' }),
    },
    subscriptions: {
      create: vi
        .fn()
        .mockResolvedValue({ id: 'sub_1', trial_end: 1_700_000_000 }),
    },
    ...overrides,
  } as unknown as Stripe
}

function makeDeps() {
  return {
    getApp: {
      getByAppCodeAndDomainId: vi.fn().mockResolvedValue({ id: 'app1' }),
    },
    getDomain: { getDomainById: vi.fn().mockResolvedValue({ name: 'acme' }) },
    bitrix: { updateCrmItem: vi.fn().mockResolvedValue(undefined) },
    createSubscriptionRepo: {
      create: vi.fn().mockResolvedValue({ appId: 'app1' }),
    },
    spaRepository: { get: vi.fn().mockResolvedValue({ id: 'spa1' }) },
    provisionDeps: {} as never,
  }
}

function makeReqRes(body: Record<string, unknown>) {
  const req = { domainId: 'dom1', appId: 'app1', body } as unknown as Request
  const res = {} as Response
  return { req, res }
}

type SubCreateArg = {
  items: Array<{ price: string; quantity: number }>
  metadata: { provider: string }
  trial_period_days: number
  trial_settings: { end_behavior: { missing_payment_method: string } }
}

function subCreateArg(stripe: Stripe): SubCreateArg {
  const fn = stripe.subscriptions.create as unknown as ReturnType<typeof vi.fn>
  return fn.mock.calls[0]![0] as SubCreateArg
}

describe('ActivateTrialController', () => {
  beforeEach(() => {
    provisionMock.mockClear()
  })

  it('trial ZAPI: usa price Z-API, metadata provider ZAPI e provisiona ZAPI', async () => {
    const stripe = makeStripe()
    const d = makeDeps()
    const controller = new ActivateTrialController(
      d.getApp as never,
      d.getDomain as never,
      d.bitrix as never,
      d.createSubscriptionRepo as never,
      d.spaRepository as never,
      d.provisionDeps,
      stripe,
    )
    const { req, res } = makeReqRes({
      name: 'Ana',
      email: 'ana@acme.com',
      phone: '11999',
      company: 'Acme',
      provider: 'ZAPI',
    })

    await controller.perform(req, res)

    const createArg = subCreateArg(stripe)
    expect(createArg.items[0]?.price).toBe('price_zapi')
    expect(createArg.metadata.provider).toBe('ZAPI')
    expect(createArg.trial_period_days).toBe(7)
    expect(createArg.trial_settings.end_behavior.missing_payment_method).toBe(
      'create_invoice',
    )
    expect(provisionMock).toHaveBeenCalledWith(
      d.provisionDeps,
      'app1',
      ConnectorProvider.ZAPI,
      1,
      { isTrialing: true },
    )
  })

  it('trial HUBMESSAGE: usa price HubMessage, metadata provider HUBMESSAGE e provisiona HubMessage', async () => {
    const stripe = makeStripe()
    const d = makeDeps()
    const controller = new ActivateTrialController(
      d.getApp as never,
      d.getDomain as never,
      d.bitrix as never,
      d.createSubscriptionRepo as never,
      d.spaRepository as never,
      d.provisionDeps,
      stripe,
    )
    const { req, res } = makeReqRes({
      name: 'Ana',
      email: 'ana@acme.com',
      phone: '11999',
      company: 'Acme',
      provider: 'HUBMESSAGE',
    })

    await controller.perform(req, res)

    const createArg = subCreateArg(stripe)
    expect(createArg.items[0]?.price).toBe('price_hub')
    expect(createArg.metadata.provider).toBe('HUBMESSAGE')
    expect(provisionMock).toHaveBeenCalledWith(
      d.provisionDeps,
      'app1',
      ConnectorProvider.HUBMESSAGE,
      1,
      { isTrialing: true },
    )
  })

  it('provider default ZAPI quando ausente no body', async () => {
    const stripe = makeStripe()
    const d = makeDeps()
    const controller = new ActivateTrialController(
      d.getApp as never,
      d.getDomain as never,
      d.bitrix as never,
      d.createSubscriptionRepo as never,
      d.spaRepository as never,
      d.provisionDeps,
      stripe,
    )
    const { req, res } = makeReqRes({
      name: 'Ana',
      email: 'ana@acme.com',
      phone: '11999',
      company: 'Acme',
    })

    await controller.perform(req, res)

    const createArg = subCreateArg(stripe)
    expect(createArg.items[0]?.price).toBe('price_zapi')
    expect(createArg.metadata.provider).toBe('ZAPI')
  })
})
