import { describe, expect, it } from 'vitest'
import { resolveChannelWebhookEvents } from './resolve-channel-webhook-events'

const URL = 'https://api.exemplo.com/api/webhooks/hubmessage'
const REQUIRED = [
  'MESSAGE_RECEIVED',
  'MESSAGE_DELIVERY',
  'CONNECTED',
  'DISCONNECTED',
]

describe('resolveChannelWebhookEvents', () => {
  it('acrescenta os eventos de conexão ao webhook existente', () => {
    expect(
      resolveChannelWebhookEvents({
        webhooks: [
          {
            id: 'wh',
            url: URL,
            events: ['MESSAGE_RECEIVED', 'MESSAGE_DELIVERY'],
          },
        ],
        webhookUrl: URL,
        requiredEvents: REQUIRED,
      }),
    ).toEqual({
      kind: 'update',
      webhookId: 'wh',
      events: REQUIRED,
      missing: ['CONNECTED', 'DISCONNECTED'],
    })
  })

  it('preserva evento extra assinado à mão', () => {
    const decision = resolveChannelWebhookEvents({
      webhooks: [
        { id: 'wh', url: URL, events: ['MESSAGE_RECEIVED', 'MESSAGE_STATUS'] },
      ],
      webhookUrl: URL,
      requiredEvents: REQUIRED,
    })

    expect(decision).toMatchObject({ kind: 'update' })
    if (decision.kind !== 'update') throw new Error()
    expect(decision.events).toEqual(
      expect.arrayContaining([...REQUIRED, 'MESSAGE_STATUS']),
    )
    expect(decision.events).toHaveLength(5)
  })

  it('não mexe no webhook já completo', () => {
    expect(
      resolveChannelWebhookEvents({
        webhooks: [
          { id: 'wh', url: `${URL}/`, events: [...REQUIRED, 'BLOCK'] },
        ],
        webhookUrl: URL,
        requiredEvents: REQUIRED,
      }),
    ).toEqual({ kind: 'unchanged', webhookId: 'wh' })
  })

  it('cria quando o canal não tem webhook nenhum', () => {
    expect(
      resolveChannelWebhookEvents({
        webhooks: [],
        webhookUrl: URL,
        requiredEvents: REQUIRED,
      }),
    ).toEqual({ kind: 'create', events: REQUIRED })
  })

  it('não cria quando o canal só tem webhook para outra URL', () => {
    expect(
      resolveChannelWebhookEvents({
        webhooks: [{ id: 'x', url: 'https://outro.com', events: REQUIRED }],
        webhookUrl: URL,
        requiredEvents: REQUIRED,
      }),
    ).toEqual({ kind: 'foreign', urls: ['https://outro.com'] })
  })

  it('com dois webhooks nossos, atualiza o que assina mais eventos', () => {
    expect(
      resolveChannelWebhookEvents({
        webhooks: [
          { id: 'a', url: URL, events: ['MESSAGE_RECEIVED'] },
          {
            id: 'b',
            url: URL,
            events: ['MESSAGE_RECEIVED', 'MESSAGE_DELIVERY'],
          },
        ],
        webhookUrl: URL,
        requiredEvents: REQUIRED,
      }),
    ).toMatchObject({ kind: 'update', webhookId: 'b' })
  })
})
