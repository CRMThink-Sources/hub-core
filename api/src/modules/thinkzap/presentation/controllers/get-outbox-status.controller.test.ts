import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import type { Request } from 'express'
import { GetOutboxStatusController } from './get-outbox-status.controller'

const NOW = new Date('2026-10-21T13:00:00.000Z')

const row = (over: Record<string, unknown>) => ({
  clientMessageId: 'c-1',
  appCode: 'crmthink.thinkzap',
  status: 'PENDING',
  cadenceWaitUntil: null,
  text: 'segredo',
  destination: '5511999998888',
  ...over,
})

const req = (ids: unknown) =>
  ({
    query: { ids },
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

function makeSut(rows: object[]) {
  const outbox = { findByClientMessageIds: vi.fn().mockResolvedValue(rows) }
  return {
    outbox,
    controller: new GetOutboxStatusController(outbox as never, () => NOW),
  }
}

describe('GetOutboxStatusController', () => {
  it('mapeia cada status', async () => {
    const { controller } = makeSut([
      row({ clientMessageId: 'a', status: 'SENT' }),
      row({ clientMessageId: 'b', status: 'FAILED' }),
      row({ clientMessageId: 'c', status: 'UNKNOWN' }),
      row({ clientMessageId: 'd', status: 'SENDING' }),
      row({ clientMessageId: 'e', status: 'PENDING' }),
    ])

    const response = await controller.perform(req('a,b,c,d,e'))

    expect(response.status).toBe(200)
    expect(
      (response.result as { messages: { status: string }[] }).messages.map(
        m => m.status,
      ),
    ).toEqual(['sent', 'failed', 'unknown', 'queued', 'queued'])
  })

  it('waiting só com cadenceWaitUntil no futuro e a row PENDING', async () => {
    const future = new Date(NOW.getTime() + 340_000)
    const { controller } = makeSut([
      row({ clientMessageId: 'a', cadenceWaitUntil: future }),
      row({
        clientMessageId: 'b',
        cadenceWaitUntil: new Date(NOW.getTime() - 1),
      }),
      row({ clientMessageId: 'c', status: 'SENT', cadenceWaitUntil: future }),
    ])

    const response = await controller.perform(req('a,b,c'))

    expect(response.result).toEqual({
      messages: [
        {
          clientMessageId: 'a',
          status: 'waiting',
          waitUntil: future.toISOString(),
        },
        { clientMessageId: 'b', status: 'queued', waitUntil: null },
        { clientMessageId: 'c', status: 'sent', waitUntil: null },
      ],
    })
  })

  it('escopa pela instalação do token e ignora ids de outro app', async () => {
    const { controller, outbox } = makeSut([
      row({ clientMessageId: 'a' }),
      row({ clientMessageId: 'x', appCode: 'outro.app' }),
    ])

    const response = await controller.perform(req('a, x'))

    expect(outbox.findByClientMessageIds).toHaveBeenCalledWith('domain-1', [
      'a',
      'x',
    ])
    expect(
      (response.result as { messages: { clientMessageId: string }[] }).messages,
    ).toHaveLength(1)
  })

  it('não devolve texto nem destino', async () => {
    const { controller } = makeSut([row({})])

    const response = await controller.perform(req('c-1'))

    const body = JSON.stringify(response.result)
    expect(body).not.toContain('segredo')
    expect(body).not.toContain('5511999998888')
  })

  it.each([undefined, '', ',,'])('400 sem ids (%s)', async ids => {
    const { controller } = makeSut([])
    expect((await controller.perform(req(ids))).status).toBe(400)
  })

  it('400 com mais de 50 ids', async () => {
    const { controller } = makeSut([])
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`).join(',')
    expect((await controller.perform(req(ids))).status).toBe(400)
  })
})
