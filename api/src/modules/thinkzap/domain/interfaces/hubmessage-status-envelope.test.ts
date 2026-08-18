import { describe, expect, it } from 'vitest'

import {
  findStatusStateItem,
  isDeliveryFailureState,
  isHubMessageStatusEnvelope,
  isHubMessageWebhookEnvelope,
  type HubMessageStatusEnvelope,
} from './hubmessage-events.interface'

/**
 * Payload real de recusa (2026-08-18, canal 40A14E...E695C). Mantido literal: cada
 * campo aqui é uma decisão do guard, e um fixture "limpo" esconderia justamente o que
 * torna este corpo diferente do de mensagem recebida.
 */
const failurePayload = {
  message: {
    _id: '01A015EEAFCA741A85FDD86E205BDD18',
    tenant: '3F1B5A0A4127610747935AE2A3968FD3',
    tenant_owner: 'email@hubmessage.io',
    channel_id: '40A14E4772D74EB78957CF0E407E695C',
    created_by: 'FOUKE',
    created: 0,
    recipient: {
      '@class': '.Recipient',
      identifier: '554388092447',
      name: '554388092447',
    },
    contents: [
      {
        '@class': 'com.arkansas.littlerock.core.domain.event.state.StateItem',
        identifier: '01A015EEB14273958125503BA647334C',
        integration_message_ids: [],
        internal_information: {
          integration_id: '01A015EEAFCA741A85FDD86E205BDD18',
        },
        moment: 1787074359618,
        phone: '554388092447',
        state: {
          '@class': '.Failed',
          failedDescription:
            'Integration with meta-whatsapp failed (HTTP 400): {"messaging_product":"whatsapp","details":"WhatsApp provided number needs display name approval before message can be sent."}',
          name: 'ERROR',
        },
        type: 'ErrorCallback',
      },
    ],
    media_webhook_processed: false,
  },
}

describe('isHubMessageStatusEnvelope', () => {
  it('reconhece o payload real de recusa', () => {
    expect(isHubMessageStatusEnvelope(failurePayload)).toBe(true)
  })

  /**
   * O motivo de o callback de status ser descartado hoje: sem `sender`, o guard de
   * mensagem recebida o rejeita — e era o único guard da rota.
   */
  it('o payload de status NÃO passa pelo guard de mensagem recebida', () => {
    expect(isHubMessageWebhookEnvelope(failurePayload)).toBe(false)
  })

  it('reconhece estado que não é de erro', () => {
    const delivered = {
      message: {
        _id: 'HM-1',
        channel_id: 'CH-1',
        contents: [{ identifier: 'ST-1', state: { name: 'DELIVERED' } }],
      },
    }

    expect(isHubMessageStatusEnvelope(delivered)).toBe(true)
  })

  it('recusa corpo sem channel_id', () => {
    expect(
      isHubMessageStatusEnvelope({
        message: { _id: 'HM-1', contents: [{ state: { name: 'ERROR' } }] },
      }),
    ).toBe(false)
  })

  it('recusa corpo sem _id', () => {
    expect(
      isHubMessageStatusEnvelope({
        message: {
          channel_id: 'CH-1',
          contents: [{ state: { name: 'ERROR' } }],
        },
      }),
    ).toBe(false)
  })

  it('recusa contents vazio ou sem state', () => {
    expect(
      isHubMessageStatusEnvelope({
        message: { _id: 'HM-1', channel_id: 'CH-1', contents: [] },
      }),
    ).toBe(false)
    expect(
      isHubMessageStatusEnvelope({
        message: {
          _id: 'HM-1',
          channel_id: 'CH-1',
          contents: [{ identifier: 'ST-1' }],
        },
      }),
    ).toBe(false)
  })

  it('recusa mensagem recebida (sem contents de estado)', () => {
    expect(
      isHubMessageStatusEnvelope({
        message: {
          _id: 'HM-1',
          channel_id: 'CH-1',
          sender: { identifier: '5511999999999' },
          contents: [{ type: 'TEXT', message: 'oi' }],
        },
      }),
    ).toBe(false)
  })
})

describe('isDeliveryFailureState', () => {
  it('erro por name', () => {
    expect(isDeliveryFailureState({ name: 'ERROR' })).toBe(true)
  })

  it('erro por @class, mesmo com name diferente', () => {
    expect(isDeliveryFailureState({ '@class': '.Failed', name: 'X' })).toBe(
      true,
    )
  })

  it('estado de sucesso não é erro', () => {
    expect(
      isDeliveryFailureState({ '@class': '.Sent', name: 'DELIVERED' }),
    ).toBe(false)
  })

  it('estado ausente não é erro', () => {
    expect(isDeliveryFailureState(undefined)).toBe(false)
  })
})

describe('findStatusStateItem', () => {
  it('devolve o item de erro do payload real', () => {
    const item = findStatusStateItem(
      failurePayload as unknown as HubMessageStatusEnvelope,
    )

    expect(item?.identifier).toBe('01A015EEB14273958125503BA647334C')
    expect(item?.state?.failedDescription).toContain('display name approval')
  })

  /**
   * `contents[0]` cego deixaria a recusa passar em silêncio quando ela vem depois de
   * um estado neutro no mesmo callback.
   */
  it('prefere o item de erro mesmo quando não é o primeiro', () => {
    const mixed = {
      message: {
        _id: 'HM-1',
        channel_id: 'CH-1',
        contents: [
          { identifier: 'ST-1', state: { name: 'SENT' } },
          { identifier: 'ST-2', state: { name: 'ERROR' } },
        ],
      },
    } as unknown as HubMessageStatusEnvelope

    expect(findStatusStateItem(mixed)?.identifier).toBe('ST-2')
  })

  it('sem erro, devolve o primeiro item com estado', () => {
    const onlyNeutral = {
      message: {
        _id: 'HM-1',
        channel_id: 'CH-1',
        contents: [
          { identifier: 'ST-0' },
          { identifier: 'ST-1', state: { name: 'SENT' } },
        ],
      },
    } as unknown as HubMessageStatusEnvelope

    expect(findStatusStateItem(onlyNeutral)?.identifier).toBe('ST-1')
  })
})
