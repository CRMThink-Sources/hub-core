import { describe, expect, it, vi } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplateSendNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateMessageSender } from '@/modules/thinkzap/domain/ports/template-message-sender.port'
import { UnsupportedTemplateSender } from '../adapters/unsupported-template-sender.adapter'
import { MapTemplateSenderResolver } from './map-template-sender-resolver'

const target = {
  channelId: 'chan_1',
  recipientIdentifier: '5511999999999',
}

function stubSender(): TemplateMessageSender {
  return {
    supportsTemplateSend: true,
    send: vi.fn().mockResolvedValue({ messageId: 'msg_1' }),
  }
}

describe('MapTemplateSenderResolver', () => {
  it('devolve o sender do provider registrado, com o target aplicado', () => {
    const factory = vi.fn(() => stubSender())
    const resolver = new MapTemplateSenderResolver({
      [ConnectorProvider.HUBMESSAGE]: factory,
    })

    const sender = resolver.resolve(ConnectorProvider.HUBMESSAGE, target)

    expect(factory).toHaveBeenCalledWith(target)
    expect(sender.supportsTemplateSend).toBe(true)
  })

  it('lança para provider não registrado', () => {
    const resolver = new MapTemplateSenderResolver({})

    expect(() =>
      resolver.resolve(ConnectorProvider.HUBMESSAGE, target),
    ).toThrow(TemplateSendNotSupportedError)
  })

  it('provider sem suporte recusa o envio sem chamar nada remoto', async () => {
    const resolver = new MapTemplateSenderResolver({
      [ConnectorProvider.ZAPI]: () => new UnsupportedTemplateSender('ZAPI'),
    })

    const sender = resolver.resolve(ConnectorProvider.ZAPI, target)

    expect(sender.supportsTemplateSend).toBe(false)
    await expect(
      (async () =>
        sender.send({
          templateName: 'order_update',
          language: 'pt_BR',
          bodyParameters: [],
        }))(),
    ).rejects.toThrow(TemplateSendNotSupportedError)
  })
})
