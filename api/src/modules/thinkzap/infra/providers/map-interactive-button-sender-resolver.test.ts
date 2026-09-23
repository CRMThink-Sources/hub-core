import { describe, expect, it, vi } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InteractiveButtonSendNotSupportedError } from '@/modules/thinkzap/domain/ports/button-errors'
import { InteractiveButtonSender } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { MapInteractiveButtonSenderResolver } from './map-interactive-button-sender-resolver'

const target = {
  channelId: 'chan_1',
  instanceId: 'inst_1',
  instanceToken: 'token_1',
  recipientIdentifier: '5511999999999',
}

function stubSender(): InteractiveButtonSender {
  return { send: vi.fn().mockResolvedValue({ messageId: 'msg_1' }) }
}

describe('MapInteractiveButtonSenderResolver', () => {
  it('devolve o sender do provider registrado, com o target aplicado', () => {
    const factory = vi.fn(() => stubSender())
    const resolver = new MapInteractiveButtonSenderResolver({
      [ConnectorProvider.HUBMESSAGE]: factory,
    })

    const sender = resolver.resolve(ConnectorProvider.HUBMESSAGE, target)

    expect(factory).toHaveBeenCalledWith(target)
    expect(sender).toBeDefined()
  })

  it('resolve os dois providers quando ambos registrados', () => {
    const resolver = new MapInteractiveButtonSenderResolver({
      [ConnectorProvider.ZAPI]: () => stubSender(),
      [ConnectorProvider.HUBMESSAGE]: () => stubSender(),
    })

    expect(resolver.resolve(ConnectorProvider.ZAPI, target)).toBeDefined()
    expect(resolver.resolve(ConnectorProvider.HUBMESSAGE, target)).toBeDefined()
  })

  it('lança para provider não registrado, sem chamar nada remoto', () => {
    const resolver = new MapInteractiveButtonSenderResolver({})

    expect(() =>
      resolver.resolve(ConnectorProvider.HUBMESSAGE, target),
    ).toThrow(InteractiveButtonSendNotSupportedError)
  })
})
