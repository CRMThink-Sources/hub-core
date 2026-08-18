import { describe, expect, it } from 'vitest'

import { describeHubMessageDeliveryFailure } from './describe-hubmessage-delivery-failure'

/** O `failedDescription` exato do caso que motivou a change (2026-08-18). */
const DISPLAY_NAME_RAW =
  'Integration with meta-whatsapp failed (HTTP 400): {"messaging_product":"whatsapp","details":"WhatsApp provided number needs display name approval before message can be sent."}'

describe('describeHubMessageDeliveryFailure', () => {
  it('nome de exibição sem aprovação aponta o Gerenciador da Meta', () => {
    const notice = describeHubMessageDeliveryFailure(DISPLAY_NAME_RAW)

    expect(notice).toContain('nome de exibição')
    expect(notice).toContain('Gerenciador')
    // O cru não vai ao chat quando o padrão casou: a frase já diz o que fazer.
    expect(notice).not.toContain('messaging_product')
  })

  it('janela de 24h fechada aponta template', () => {
    const notice = describeHubMessageDeliveryFailure(
      'Integration with meta-whatsapp failed (HTTP 400): {"details":"Message failed to send because more than 24 hours have passed since the customer last replied (re-engagement)."}',
    )

    expect(notice).toContain('24 horas')
    expect(notice).toContain('template')
  })

  it('número sem WhatsApp ativo manda conferir o telefone', () => {
    const notice = describeHubMessageDeliveryFailure(
      'meta returned: recipient is not a valid whatsapp user',
    )

    expect(notice).toContain('não tem WhatsApp ativo')
  })

  it('limite de envio pede nova tentativa', () => {
    const notice = describeHubMessageDeliveryFailure(
      'HTTP 429: business account throughput rate limit hit',
    )

    expect(notice).toContain('limite de envio')
  })

  /**
   * Padrão novo é o caso mais provável no futuro: o fallback precisa carregar o cru,
   * senão o operador fica com "não foi entregue" e ninguém tem por onde começar.
   */
  it('erro desconhecido leva o retorno cru ao chat', () => {
    const notice = describeHubMessageDeliveryFailure(
      'Integration with meta-whatsapp failed (HTTP 500): {"details":"internal gremlins"}',
    )

    expect(notice).toContain('recusou o envio')
    expect(notice).toContain('internal gremlins')
  })

  it('trunca retorno cru muito longo', () => {
    const notice = describeHubMessageDeliveryFailure('x'.repeat(1000))

    expect(notice).toContain('…')
    expect(notice.length).toBeLessThan(450)
  })

  it('sem descrição ainda produz aviso', () => {
    expect(describeHubMessageDeliveryFailure(undefined)).toContain(
      'não informou o motivo',
    )
    expect(describeHubMessageDeliveryFailure('   ')).toContain(
      'não informou o motivo',
    )
  })
})
