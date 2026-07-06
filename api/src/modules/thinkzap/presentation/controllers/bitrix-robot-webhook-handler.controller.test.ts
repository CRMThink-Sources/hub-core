import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const { sendMessageMock, getPhoneDataMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  getPhoneDataMock: vi.fn(),
}))

vi.mock('../../infra/clients/z-api.client', () => ({
  ZApiClient: class {
    sendMessage = sendMessageMock
    getPhoneData = getPhoneDataMock
  },
}))

import { BitrixRobotWebhookHandlerController } from './bitrix-robot-webhook-handler.controller'

const crmItem = (
  id: string,
  name: string,
  phone?: string,
  extra: Record<string, unknown> = {},
) => ({
  result: {
    item: {
      id,
      name,
      fm: phone ? [{ typeId: 'PHONE', value: phone }] : [],
      ...extra,
    },
  },
})

const makeDeps = (
  overrides: {
    bitrix?: Record<string, ReturnType<typeof vi.fn>>
  } = {},
) => {
  const getDomain = { getDomain: vi.fn().mockResolvedValue({ id: 'domain-1' }) }
  const getApp = {
    getByAppCodeAndDomainId: vi.fn().mockResolvedValue({ id: 'app-1' }),
  }
  const getConnector = {
    get: vi.fn().mockResolvedValue({ instanceId: 'inst-1' }),
  }
  const getInstance = {
    getInstance: vi
      .fn()
      .mockResolvedValue({ instanceId: 'zapi-inst', zApiToken: 'tok' }),
  }
  const sendNotification = { execute: vi.fn().mockResolvedValue(undefined) }
  const bitrix = {
    getCrmItem: vi.fn(),
    getDealContactIds: vi.fn().mockResolvedValue([]),
    getCompanyContactIds: vi.fn().mockResolvedValue([]),
    ...overrides.bitrix,
  }

  return {
    getDomain,
    getApp,
    getConnector,
    getInstance,
    sendNotification,
    bitrix,
  }
}

const makeController = (deps: ReturnType<typeof makeDeps>) =>
  new BitrixRobotWebhookHandlerController(
    deps.getDomain as never,
    deps.getApp as never,
    deps.getConnector as never,
    deps.getInstance as never,
    deps.sendNotification as never,
    deps.bitrix as never,
  )

const makeReq = (properties: Record<string, unknown>): Request =>
  ({
    body: {
      document_id: ['crm', 'CCrmDocumentDeal', 'DEAL_10'],
      properties,
      auth: { domain: 'test.bitrix24.com' },
    },
  }) as unknown as Request

const res = {} as Response

beforeEach(() => {
  sendMessageMock.mockReset().mockResolvedValue({ messageId: 'm' })
  getPhoneDataMock.mockReset().mockResolvedValue({ phone: '5599' })
})

describe('BitrixRobotWebhookHandlerController', () => {
  it('toggle OFF + destination → single send (existing behavior)', async () => {
    const deps = makeDeps()
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq({ connector: 'conn', destination: '5511999', message: 'oi' }),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      'zapi-inst',
      'tok',
      'oi',
      '5511999',
    )
    expect(result.status).toBe(200)
  })

  it('toggle ON → sends once per unique related phone (dedup applied)', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            if (entityTypeId === 3 && id === '101')
              return Promise.resolve(crmItem('101', 'B', '551100')) // dup phone
            if (entityTypeId === 3 && id === '102')
              return Promise.resolve(crmItem('102', 'C', '552200'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100', '101', '102']),
      },
    })
    const controller = makeController(deps)

    await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    const sentPhones = sendMessageMock.mock.calls
      .map(c => c[3] as string)
      .sort()
    expect(sentPhones).toEqual(['551100', '552200'])
  })

  it('toggle ON ignores manual destination', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100']),
      },
    })
    const controller = makeController(deps)

    await controller.perform(
      makeReq({
        connector: 'conn',
        destination: '5500MANUAL',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    const sentPhones = sendMessageMock.mock.calls.map(c => c[3] as string)
    expect(sentPhones).toEqual(['551100'])
    expect(sentPhones).not.toContain('5500MANUAL')
  })

  it('one recipient send fails → others still sent, failure isolated', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi
          .fn()
          .mockImplementation((entityTypeId: number, id: string) => {
            if (entityTypeId === 2 && id === '10')
              return Promise.resolve(crmItem('10', 'Deal'))
            if (entityTypeId === 3 && id === '100')
              return Promise.resolve(crmItem('100', 'A', '551100'))
            if (entityTypeId === 3 && id === '101')
              return Promise.resolve(crmItem('101', 'B', '552200'))
            return Promise.reject(new Error('unexpected'))
          }),
        getDealContactIds: vi.fn().mockResolvedValue(['100', '101']),
      },
    })
    sendMessageMock.mockReset()
    sendMessageMock.mockRejectedValueOnce(new Error('boom'))
    sendMessageMock.mockResolvedValue({ messageId: 'm' })

    const controller = makeController(deps)
    const result = await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(result.status).toBe(200)
    expect((result.result as { sent: number }).sent).toBe(1)
  })

  it('unknown entity / no phones → no send, no throw, notification recorded', async () => {
    const deps = makeDeps({
      bitrix: {
        getCrmItem: vi.fn().mockResolvedValue(crmItem('10', 'Deal')),
        getDealContactIds: vi.fn().mockResolvedValue([]),
      },
    })
    const controller = makeController(deps)

    const result = await controller.perform(
      makeReq({
        connector: 'conn',
        sendToAllRelatedContacts: 'Y',
        message: 'oi',
      }),
      res,
    )

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(result.status).toBe(200)
    expect(deps.sendNotification.execute).toHaveBeenCalledTimes(1)
  })
})
