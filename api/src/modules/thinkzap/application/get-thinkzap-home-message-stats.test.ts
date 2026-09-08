import { describe, expect, it, vi } from 'vitest'
import { getThinkzapHomeMessageStats } from './get-thinkzap-home-message-stats'

const FROM = new Date('2026-01-01T00:00:00.000Z')
const TO = new Date('2026-02-01T00:00:00.000Z')

function zapiItem(zApiInstanceId: string) {
  return {
    metadata: { provider: 'ZAPI', zApiInstanceId, zApiInstanceToken: 'tok' },
  }
}

function hubItem(hubmessageChannelId: string) {
  return { metadata: { provider: 'HUBMESSAGE', hubmessageChannelId } }
}

function makeContext(items: unknown[]) {
  return {
    execute: vi.fn().mockResolvedValue({
      customer: {},
      aplication: {},
      subscriptions: [
        { status: 'active', currentPeriodEnd: new Date('2099-01-01'), items },
      ],
    }),
  }
}

function makeInstanceRepo(
  byInstanceId: Record<string, { id: string; channelId: string | null }>,
  byChannelId: Record<string, { id: string; channelId: string | null }> = {},
) {
  return {
    getInstance: vi.fn(),
    getInstanceByInstanceId: vi
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(byInstanceId[id] ?? null),
      ),
    getInstanceByChannelId: vi
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(byChannelId[id] ?? null),
      ),
  }
}

describe('getThinkzapHomeMessageStats', () => {
  it('soma mensagens de duas linhas Z-API no mesmo total', async () => {
    const getAplicationContext = makeContext([
      zapiItem('inst-a'),
      zapiItem('inst-b'),
    ])
    const instanceRepo = makeInstanceRepo({
      'inst-a': { id: 'db-a', channelId: null },
      'inst-b': { id: 'db-b', channelId: null },
    })
    const messageRepo = {
      countByInstanceAndSource: vi.fn().mockResolvedValue([
        { instanceId: 'db-a', source: 'BITRIX', count: 10 },
        { instanceId: 'db-a', source: 'ZAPI', count: 20 },
        { instanceId: 'db-b', source: 'BITRIX', count: 7 },
        { instanceId: 'db-b', source: 'ZAPI', count: 3 },
      ]),
    }

    const result = await getThinkzapHomeMessageStats({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      from: FROM,
      to: TO,
      getAplicationContext,
      instanceRepo,
      messageRepo,
    })

    expect(result).toEqual({ zapi: { sent: 17, received: 23 } })
    expect(result.hubmessage).toBeUndefined()
  })

  it('domínio com os dois providers retorna as duas chaves', async () => {
    const getAplicationContext = makeContext([
      zapiItem('inst-a'),
      hubItem('chan-1'),
    ])
    const instanceRepo = makeInstanceRepo(
      { 'inst-a': { id: 'db-a', channelId: null } },
      { 'chan-1': { id: 'db-hub', channelId: 'chan-1' } },
    )
    const messageRepo = {
      countByInstanceAndSource: vi.fn().mockResolvedValue([
        { instanceId: 'db-a', source: 'BITRIX', count: 5 },
        { instanceId: 'db-hub', source: 'HUBMESSAGE', count: 8 },
      ]),
    }

    const result = await getThinkzapHomeMessageStats({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      from: FROM,
      to: TO,
      getAplicationContext,
      instanceRepo,
      messageRepo,
    })

    expect(result).toEqual({
      zapi: { sent: 5, received: 0 },
      hubmessage: { sent: 0, received: 8 },
    })
  })

  it('domínio sem nenhuma linha de um provider não lança erro e omite a chave', async () => {
    const getAplicationContext = makeContext([zapiItem('inst-a')])
    const instanceRepo = makeInstanceRepo({
      'inst-a': { id: 'db-a', channelId: null },
    })
    const messageRepo = {
      countByInstanceAndSource: vi
        .fn()
        .mockResolvedValue([
          { instanceId: 'db-a', source: 'BITRIX', count: 1 },
        ]),
    }

    const result = await getThinkzapHomeMessageStats({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      from: FROM,
      to: TO,
      getAplicationContext,
      instanceRepo,
      messageRepo,
    })

    expect(result.hubmessage).toBeUndefined()
    expect(messageRepo.countByInstanceAndSource).toHaveBeenCalledTimes(1)
  })

  it('domínio sem nenhuma linha ativa não chama a contagem', async () => {
    const getAplicationContext = makeContext([])
    const instanceRepo = makeInstanceRepo({})
    const messageRepo = { countByInstanceAndSource: vi.fn() }

    const result = await getThinkzapHomeMessageStats({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      from: FROM,
      to: TO,
      getAplicationContext,
      instanceRepo,
      messageRepo,
    })

    expect(result).toEqual({})
    expect(messageRepo.countByInstanceAndSource).not.toHaveBeenCalled()
  })

  it('linha sem âncora local ainda (nunca trocou mensagem) não quebra e não conta', async () => {
    const getAplicationContext = makeContext([zapiItem('inst-a')])
    const instanceRepo = makeInstanceRepo({})
    const messageRepo = { countByInstanceAndSource: vi.fn() }

    const result = await getThinkzapHomeMessageStats({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      from: FROM,
      to: TO,
      getAplicationContext,
      instanceRepo,
      messageRepo,
    })

    expect(result).toEqual({})
    expect(messageRepo.countByInstanceAndSource).not.toHaveBeenCalled()
  })
})
