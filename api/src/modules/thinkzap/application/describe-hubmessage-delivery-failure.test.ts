import { describe, expect, it } from 'vitest'

import type {
  HubMessageDeliveryError,
  HubMessageStateItem,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { describeHubMessageDeliveryFailure } from './describe-hubmessage-delivery-failure'

/** O `failedDescription` exato do caso que motivou a tradução (2026-08-18). */
const DISPLAY_NAME_RAW =
  'Integration with meta-whatsapp failed (HTTP 400): {"messaging_product":"whatsapp","details":"WhatsApp provided number needs display name approval before message can be sent."}'

/** Item de estado só com `failedDescription`, como era a entrada antiga. */
const withDescription = (
  failedDescription: string | undefined,
): HubMessageStateItem => ({
  type: 'ErrorCallback',
  state: { '@class': '.Failed', name: 'ERROR', failedDescription },
})

/** Item de estado com `errors[]` e `failedDescription: null`, como no `131047`. */
const withErrors = (
  errors: HubMessageDeliveryError[],
  failedDescription?: string,
): HubMessageStateItem => ({
  type: 'ErrorCallback',
  external_information: { errors },
  state: { '@class': '.Failed', name: 'ERROR', failedDescription },
})

describe('describeHubMessageDeliveryFailure', () => {
  it('nome de exibição sem aprovação aponta o Gerenciador da Meta', () => {
    const notice = describeHubMessageDeliveryFailure(
      withDescription(DISPLAY_NAME_RAW),
    )

    expect(notice).toContain('nome de exibição')
    expect(notice).toContain('Gerenciador')
    // O cru não vai ao chat quando o padrão casou: a frase já diz o que fazer.
    expect(notice).not.toContain('messaging_product')
  })

  it('janela de 24h fechada aponta template', () => {
    const notice = describeHubMessageDeliveryFailure(
      withDescription(
        'Integration with meta-whatsapp failed (HTTP 400): {"details":"Message failed to send because more than 24 hours have passed since the customer last replied (re-engagement)."}',
      ),
    )

    expect(notice).toContain('24 horas')
    expect(notice).toContain('template')
  })

  it('número sem WhatsApp ativo manda conferir o telefone', () => {
    const notice = describeHubMessageDeliveryFailure(
      withDescription('meta returned: recipient is not a valid whatsapp user'),
    )

    expect(notice).toContain('não tem WhatsApp ativo')
  })

  it('limite de envio pede nova tentativa', () => {
    const notice = describeHubMessageDeliveryFailure(
      withDescription('HTTP 429: business account throughput rate limit hit'),
    )

    expect(notice).toContain('limite de envio')
  })

  /**
   * Padrão novo é o caso mais provável no futuro: o fallback precisa carregar o cru,
   * senão o operador fica com "não foi entregue" e ninguém tem por onde começar.
   */
  it('erro desconhecido leva o retorno cru ao chat', () => {
    const notice = describeHubMessageDeliveryFailure(
      withDescription(
        'Integration with meta-whatsapp failed (HTTP 500): {"details":"internal gremlins"}',
      ),
    )

    expect(notice).toContain('recusou o envio')
    expect(notice).toContain('internal gremlins')
  })

  it('trunca retorno cru muito longo', () => {
    const notice = describeHubMessageDeliveryFailure(
      withDescription('x'.repeat(1000)),
    )

    expect(notice).toContain('…')
    expect(notice.length).toBeLessThan(450)
  })

  it('sem descrição ainda produz aviso', () => {
    expect(
      describeHubMessageDeliveryFailure(withDescription(undefined)),
    ).toContain('não informou o motivo')
    expect(describeHubMessageDeliveryFailure(withDescription('   '))).toContain(
      'não informou o motivo',
    )
    expect(describeHubMessageDeliveryFailure(undefined)).toContain(
      'não informou o motivo',
    )
  })

  /**
   * O caso que motivou esta mudança (2026-08-30, traceKey
   * b6758d52-6ce8-40fd-9d25-c59235bc07b1): `failedDescription` nulo e o motivo inteiro
   * dentro de `errors[]`. O aviso antigo era "não informou o motivo. Verifique a
   * conexão da linha" — as duas metades erradas.
   */
  it('código 131047 com failedDescription nulo aponta janela e template', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([
        {
          code: '131047',
          href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/',
          title: 'Re-engagement message',
          message: 'Re-engagement message',
          error_data: {
            details:
              'Message failed to send because more than 24 hours have passed since the customer last replied to this number.',
          },
        },
      ]),
    )

    expect(notice).toContain('24 horas')
    expect(notice).toContain('template')
    expect(notice).not.toContain('não informou o motivo')
    expect(notice).not.toContain('conexão da linha')
  })

  it('código desconhecido cai no casamento por texto do errors[]', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([
        {
          code: '199999',
          title: 'Something else',
          error_data: {
            details:
              'Message failed to send because more than 24 hours have passed since the customer last replied to this number.',
          },
        },
      ]),
    )

    expect(notice).toContain('24 horas')
    expect(notice).toContain('template')
  })

  it('template pausado pela Meta manda usar outro template', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([{ code: '132015', title: 'Template is paused' }]),
    )

    expect(notice).toContain('pausou este template')
    expect(notice).toContain('outro template')
  })

  /**
   * A ordem do array não pode decidir se o operador recebe frase útil ou genérico.
   */
  it('usa o segundo erro quando só ele tem código mapeado', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([
        { code: '199999', title: 'Unknown thing' },
        { code: '131026', title: 'Message undeliverable' },
      ]),
    )

    expect(notice).toContain('não conseguiu entregar')
    expect(notice).toContain('Confira o telefone')
  })

  it('código não mapeado e texto sem padrão mostram o código no genérico', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([
        {
          code: '131099',
          title: 'Unknown error',
          message: 'internal gremlins',
        },
      ]),
    )

    expect(notice).toContain('erro 131099')
    expect(notice).toContain('internal gremlins')
  })

  it('aceita code numérico', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([{ code: 131047 as unknown as string }]),
    )

    expect(notice).toContain('24 horas')
  })

  it('errors[] vazio com failedDescription usa o failedDescription', () => {
    const notice = describeHubMessageDeliveryFailure(
      withErrors([], DISPLAY_NAME_RAW),
    )

    expect(notice).toContain('nome de exibição')
  })

  it('sem errors[] e sem failedDescription informa o silêncio do provedor', () => {
    const notice = describeHubMessageDeliveryFailure(withErrors([]))

    expect(notice).toContain('não informou o motivo')
  })
})

describe('describeHubMessageDeliveryFailure por idioma', () => {
  it('131026 em espanhol', () => {
    const notice = describeHubMessageDeliveryFailure(
      {
        external_information: { errors: [{ code: 131026 }] },
      } as never,
      'es',
    )

    expect(notice).toBe(
      '⚠️ Su mensaje no fue entregado: WhatsApp no pudo entregar el mensaje a este ' +
        'número. En general es un número sin WhatsApp activo, o una cuenta que no ' +
        'acepta recibir de este remitente. Revise el teléfono en el CRM antes de ' +
        'intentar de nuevo.',
    )
  })

  it('sem motivo em inglês', () => {
    expect(describeHubMessageDeliveryFailure(undefined, 'en')).toBe(
      '⚠️ Your message was not delivered: WhatsApp Official declined the message ' +
        'and did not give a reason. Check the line connection and try again.',
    )
  })

  it('genérica em inglês com código e retorno cru', () => {
    const notice = describeHubMessageDeliveryFailure(
      {
        external_information: {
          errors: [{ code: 131099, message: 'raw provider text' }],
        },
      } as never,
      'en',
    )

    expect(notice).toContain('(error 131099)')
    expect(notice).toContain('Provider response: raw provider text')
  })
})
