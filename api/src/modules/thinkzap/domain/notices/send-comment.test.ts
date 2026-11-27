import { describe, expect, it } from 'vitest'
import type { RecipientSummary, SendPart } from '../send-notice'
import type { NoticeLocale } from './notice-locale'
import {
  renderSendAlert,
  renderSendComment,
  type SendCommentInput,
} from './send-comment'

function part(destination: string): SendPart {
  return {
    destination,
    status: 'FAILED',
    rejectedAt: null,
    lastError: null,
    failureCode: null,
    failureReason: null,
  }
}

const waiting = (destination: string): RecipientSummary => ({
  destination,
  state: 'WAITING',
  failedPart: null,
})

const sent = (destination: string): RecipientSummary => ({
  destination,
  state: 'SENT',
  failedPart: null,
})

const failed = (destination: string): RecipientSummary => ({
  destination,
  state: 'FAILED',
  failedPart: part(destination),
})

const partial = (destination: string): RecipientSummary => ({
  destination,
  state: 'PARTIAL',
  failedPart: part(destination),
})

const unknown = (destination: string): RecipientSummary => ({
  destination,
  state: 'UNKNOWN',
  failedPart: part(destination),
})

const sentMany = (count: number) =>
  Array.from({ length: count }, (_, i) => sent(`55110000${100 + i}`))

function base(overrides: Partial<SendCommentInput> = {}): SendCommentInput {
  return {
    locale: 'pt',
    kind: 'message',
    automation: false,
    fromPhone: '5511888888888',
    text: 'Olá',
    recipients: [sent('5511999999999')],
    describeFailure: () => 'número inválido',
    ...overrides,
  }
}

const lastLine = (text: string) => text.split('\n').at(-1)

describe('renderSendComment com um destinatário', () => {
  it('um destinatário: status no rodapé', () => {
    const text = renderSendComment(
      base({ recipients: [sent('5511999999999')] }),
    )

    expect(text).toBe(
      [
        '[B]Mensagem enviada[/B]',
        '[B]De:[/B] 5511888888888',
        '[B]Para:[/B] 5511999999999',
        '[B]Mensagem:[/B]',
        'Olá',
        '[B]Status:[/B] Enviado',
      ].join('\n'),
    )
  })

  it('envio por automação usa o título do robô', () => {
    const text = renderSendComment(base({ automation: true }))

    expect(text.split('\n')[0]).toBe('[B]Mensagem enviada pelo robô[/B]')
  })

  it('template oficial mostra nome e idioma', () => {
    expect(
      renderSendComment(
        base({
          kind: 'template',
          template: { name: 'boas_vindas', language: 'pt_BR' },
        }),
      ),
    ).toContain('[B]Template:[/B] boas_vindas (pt_BR)')
  })

  it('sem texto não gera a linha de mensagem', () => {
    expect(renderSendComment(base({ text: '' }))).not.toContain('Mensagem:')
  })

  it('sem confirmação acrescenta a orientação no próprio rodapé', () => {
    const text = renderSendComment(base({ recipients: [unknown('551')] }))

    expect(lastLine(text)).toBe(
      '[B]Status:[/B] Sem confirmação. Confira a conversa com o contato ANTES de reenviar — ela pode ter sido entregue.',
    )
  })

  it('motivo com quebra de linha continua no rodapé', () => {
    const text = renderSendComment(
      base({
        recipients: [failed('551')],
        describeFailure: () => 'linha um\r\nlinha dois',
      }),
    )

    expect(lastLine(text)).toBe('[B]Status:[/B] Falhou: linha um linha dois')
  })

  it('explica a falha com a parte que falhou', () => {
    const text = renderSendComment(
      base({
        recipients: [failed('551')],
        describeFailure: failedPart => `parte de ${failedPart.destination}`,
      }),
    )

    expect(lastLine(text)).toBe('[B]Status:[/B] Falhou: parte de 551')
  })

  it('motivo do provedor não vira marcação', () => {
    const text = renderSendComment(
      base({
        recipients: [failed('551')],
        describeFailure: () => '[url]x[/url]',
      }),
    )

    expect(text).not.toContain('[url]')
    expect(text).not.toContain('[/url]')
  })

  it('destino, template e texto não viram marcação', () => {
    const text = renderSendComment(
      base({
        fromPhone: '[url]de[/url]',
        template: { name: '[url]t[/url]', language: 'pt_BR' },
        text: '[url]m[/url]',
        recipients: [sent('[url]para[/url]')],
        files: {
          sent: ['[url]a.pdf[/url]'],
          failed: [{ name: '[url]b.pdf[/url]', reason: 'too_large' }],
        },
      }),
    )

    expect(text).not.toContain('[url]')
    expect(text).not.toContain('[/url]')
  })

  it('cita os arquivos enviados e os não enviados', () => {
    const text = renderSendComment(
      base({
        files: {
          sent: ['a.pdf', 'b.pdf'],
          failed: [{ name: 'c.pdf', reason: 'too_large' }],
        },
      }),
    )

    expect(text).toContain('[B]Arquivos enviados:[/B] a.pdf, b.pdf')
    expect(text).toContain(
      '[B]Arquivos não enviados:[/B] c.pdf (maior que 30 MB)',
    )
    expect(lastLine(text)).toBe('[B]Status:[/B] Enviado')
  })

  it('listas de arquivos vazias não geram linhas', () => {
    const text = renderSendComment(base({ files: { sent: [], failed: [] } }))

    expect(text).not.toContain('Arquivos')
  })
})

describe('renderSendComment com vários destinatários', () => {
  it('mostra a quantidade e uma linha por destinatário', () => {
    const text = renderSendComment(
      base({
        recipients: [
          waiting('551'),
          sent('552'),
          failed('553'),
          partial('554'),
        ],
      }),
    )

    expect(text).toContain('[B]Para:[/B] 4')
    expect(text.split('\n').slice(-5)).toEqual([
      '[B]Status:[/B]',
      '551 — Aguardando envio',
      '552 — Enviado',
      '553 — Falhou: número inválido',
      '554 — Falhou em parte: número inválido',
    ])
  })

  it('a orientação de sem confirmação aparece uma única vez, ao fim', () => {
    const text = renderSendComment(
      base({ recipients: [unknown('551'), unknown('552')] }),
    )

    expect(text.split('ANTES de reenviar')).toHaveLength(2)
    expect(text).toContain('551 — Sem confirmação\n552 — Sem confirmação')
    expect(lastLine(text)).toContain('ANTES de reenviar')
  })

  it('destino e motivo da lista não viram marcação', () => {
    const text = renderSendComment(
      base({
        recipients: [failed('[url]551[/url]'), sent('552')],
        describeFailure: () => '[url]x[/url]',
      }),
    )

    expect(text).not.toContain('[url]')
    expect(text).not.toContain('[/url]')
  })

  it('com 20 destinatários ainda lista todos', () => {
    const recipients = sentMany(20)
    const text = renderSendComment(base({ recipients }))

    for (const { destination } of recipients) {
      expect(text).toContain(`${destination} — Enviado`)
    }
  })

  it('acima de 20 destinatários detalha só as falhas', () => {
    const text = renderSendComment(
      base({ recipients: [...sentMany(24), failed('5599')] }),
    )

    expect(text).toContain('5599')
    expect(text).not.toContain(sentMany(24)[0]!.destination)
  })

  it('acima de 20 mostra totais por estado e as pendências', () => {
    const text = renderSendComment(
      base({
        recipients: [
          ...sentMany(18),
          waiting('5591'),
          failed('5592'),
          partial('5593'),
          unknown('5594'),
        ],
      }),
    )

    expect(text.split('\n').slice(-10)).toEqual([
      '[B]Status:[/B]',
      'Aguardando envio: 1',
      'Enviado: 18',
      'Falhou: 1',
      'Falhou em parte: 1',
      'Sem confirmação: 1',
      '5592 — Falhou: número inválido',
      '5593 — Falhou em parte: número inválido',
      '5594 — Sem confirmação',
      'Confira a conversa com o contato ANTES de reenviar — ela pode ter sido entregue.',
    ])
    expect(text).not.toContain('5591')
  })
})

describe('renderSendComment por idioma', () => {
  const cases: [NoticeLocale, string[]][] = [
    [
      'pt',
      [
        'Aguardando envio',
        'Enviado',
        'Falhou: x',
        'Falhou em parte: x',
        'Sem confirmação',
      ],
    ],
    [
      'en',
      [
        'Waiting to be sent',
        'Sent',
        'Failed: x',
        'Partially failed: x',
        'Not confirmed',
      ],
    ],
    [
      'es',
      [
        'Esperando envío',
        'Enviado',
        'Falló: x',
        'Falló en parte: x',
        'Sin confirmación',
      ],
    ],
  ]

  it.each(cases)('%s: usa os cinco estados do idioma', (locale, states) => {
    const text = renderSendComment(
      base({
        locale,
        describeFailure: () => 'x',
        recipients: [
          waiting('1'),
          sent('2'),
          failed('3'),
          partial('4'),
          unknown('5'),
        ],
      }),
    )

    states.forEach((state, i) => {
      expect(text).toContain(`${i + 1} — ${state}\n`)
    })
  })

  it('en: título, campos e rodapé em inglês', () => {
    const text = renderSendComment(base({ locale: 'en', automation: true }))

    expect(text).toContain('[B]Message sent by the robot[/B]')
    expect(text).toContain('[B]From:[/B] 5511888888888')
    expect(lastLine(text)).toBe('[B]Status:[/B] Sent')
  })

  it('es: título, campos e orientação em espanhol', () => {
    const text = renderSendComment(
      base({ locale: 'es', recipients: [unknown('551')] }),
    )

    expect(text).toContain('[B]Mensaje enviado[/B]')
    expect(text).toContain('[B]De:[/B] 5511888888888')
    expect(lastLine(text)).toContain('Sin confirmación. Revise la conversación')
  })
})

describe('renderSendAlert', () => {
  const alert = (
    overrides: Partial<Parameters<typeof renderSendAlert>[0]> = {},
  ) =>
    renderSendAlert({
      locale: 'pt',
      failed: 0,
      unknown: 0,
      reason: null,
      recordUrl: null,
      ...overrides,
    })

  it('diz quantas falharam e quantas ficaram sem confirmação', () => {
    const text = alert({ failed: 3, unknown: 2 })

    expect(text).toContain('Destinatários com falha no envio: 3')
    expect(text).toContain('Destinatários sem confirmação de envio: 2')
  })

  it('sem confirmação não afirma que a mensagem não saiu', () => {
    const text = alert({ unknown: 1 })

    expect(text).not.toMatch(/falha|não (foi|saiu|entreg)/i)
    expect(text).toContain('ANTES de reenviar')
  })

  it('só falhas não cita sem confirmação', () => {
    const text = alert({ failed: 1 })

    expect(text).not.toContain('sem confirmação')
    expect(text).not.toContain('ANTES de reenviar')
  })

  it('mostra o motivo e o link do registro', () => {
    const text = alert({
      failed: 1,
      reason: 'número inválido',
      recordUrl: '/crm/deal/details/9/',
    })

    expect(text).toContain('[B]Motivo:[/B] número inválido')
    expect(text).toContain('[URL=/crm/deal/details/9/]Abrir o registro[/URL]')
  })

  it('sem motivo único e sem registro, omite as duas linhas', () => {
    const text = alert({ failed: 2 })

    expect(text).not.toContain('Motivo')
    expect(text).not.toContain('[URL')
  })

  it('motivo e endereço não abrem marcação', () => {
    const text = alert({
      failed: 1,
      reason: '[url]x[/url]',
      recordUrl: '/crm/a]b[c/',
    })

    expect(text).not.toContain('[url]')
    expect(text).not.toContain('[/url]')
    expect(text).toContain('[URL=/crm/a%5Db%5Bc/]')
  })

  it.each([
    ['en', 'Recipients with a failed send: 1', 'Open the record'],
    ['es', 'Destinatarios con falla en el envío: 1', 'Abrir el registro'],
  ] as const)('%s: texto no idioma', (locale, failedLine, link) => {
    const text = alert({
      locale,
      failed: 1,
      unknown: 1,
      reason: 'x',
      recordUrl: '/crm/lead/details/1/',
    })

    expect(text).toContain(failedLine)
    expect(text).toContain(link)
  })
})
