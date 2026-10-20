import { describe, expect, it } from 'vitest'
import { connectionNotices } from './connection-notices'
import { deliveryFailureNotices } from './delivery-failure-notices'
import { historyNotices } from './history-notices'
import { NOTICE_LOCALES, type NoticeLocale } from './notice-locale'
import { openChannelNotices } from './open-channel-notices'
import { timelineNotices } from './timeline-notices'

const CATALOGS: Record<string, (locale: NoticeLocale) => object> = {
  openChannel: openChannelNotices,
  deliveryFailure: deliveryFailureNotices,
  timeline: timelineNotices,
  connection: connectionNotices,
  history: historyNotices,
}

/** Chaves em profundidade, com o tipo de cada folha (texto ou função). */
function shape(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, item]) =>
    typeof item === 'object' && item !== null
      ? shape(item, `${prefix}${key}.`)
      : [`${prefix}${key}:${typeof item}`],
  )
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value).flatMap(strings)
}

describe('catálogo de avisos do servidor', () => {
  it.each(Object.keys(CATALOGS))(
    '%s: os três idiomas têm as mesmas chaves e nenhum texto vazio',
    name => {
      const catalog = CATALOGS[name]!
      const pt = shape(catalog('pt')).sort()

      for (const locale of NOTICE_LOCALES) {
        expect(shape(catalog(locale)).sort()).toEqual(pt)
        for (const text of strings(catalog(locale))) {
          expect(text.trim()).not.toBe('')
        }
      }
    },
  )

  it.each(NOTICE_LOCALES)(
    '%s: os textos com dados interpolam os dados',
    locale => {
      const timeline = timelineNotices(locale)
      expect(timeline.widgetFailed('5511', 'Olá')).toContain('5511')
      expect(timeline.widgetFailed('5511', 'Olá')).toContain('Olá')
      expect(timeline.widgetUnknown('5511', 'Olá')).toContain('Olá')
      expect(
        timeline.widgetSentQueued({
          destination: '5511',
          templateName: 'boas_vindas',
          text: 'Olá',
        }),
      ).toContain('Template: boas_vindas')
      expect(
        timeline.widgetSentSync({
          fromPhone: '5599',
          destination: '5511',
          text: 'Olá',
        }),
      ).toContain('5599')
      expect(
        timeline.sendRobot.result({
          fromPhone: '5599',
          sent: ['551', '552'],
          message: 'oi',
        }),
      ).toContain('551, 552')
      const withFiles = timeline.sendRobot.result({
        fromPhone: '5599',
        sent: ['551'],
        message: '',
        files: {
          sent: ['proposta.pdf'],
          failed: [{ name: 'video.mp4', reason: 'too_large' }],
        },
      })
      expect(withFiles).toContain('proposta.pdf')
      expect(withFiles).toContain('video.mp4 (')
      expect(withFiles).toContain('30 MB')
      expect(timeline.buttonRobot.lineCannotSend('erro X')).toContain('erro X')
      expect(
        timeline.buttonRobot.providerMismatch('ZAPI', 'HUBMESSAGE'),
      ).toContain('HUBMESSAGE')
      expect(
        timeline.templateRobot.queued({
          templateName: 'boas_vindas',
          language: 'pt_BR',
          destinations: ['551'],
        }),
      ).toContain('"boas_vindas" (pt_BR)')

      const failure = deliveryFailureNotices(locale)
      expect(failure.generic('131099', 'retorno cru')).toContain('131099')
      expect(failure.generic(undefined, 'retorno cru')).toContain('retorno cru')

      const connection = connectionNotices(locale)
      expect(
        connection.disconnected('WhatsApp 5511', 'INST', 'timeout'),
      ).toContain('timeout')
      expect(connection.connected('WhatsApp 5511', 'INST')).toContain('INST')

      expect(
        openChannelNotices(locale).buttonActionFailed('motivo cru'),
      ).toContain('motivo cru')
    },
  )

  // Robô sem arquivo: o comentário tem que sair igual ao de antes da mudança.
  it('robô de envio sem arquivos mantém o comentário anterior', () => {
    const input = { fromPhone: '5599', sent: ['551', '552'], message: 'oi' }
    expect(timelineNotices('pt').sendRobot.result(input)).toBe(
      'De: 5599\nPara: 551, 552\nMensagem: oi',
    )
    expect(timelineNotices('en').sendRobot.result(input)).toBe(
      'From: 5599\nTo: 551, 552\nMessage: oi',
    )
    expect(timelineNotices('es').sendRobot.result(input)).toBe(
      'De: 5599\nPara: 551, 552\nMensaje: oi',
    )
  })

  it('robô de envio com arquivos lista enviados e não enviados', () => {
    expect(
      timelineNotices('pt').sendRobot.result({
        fromPhone: '5599',
        sent: ['551'],
        message: 'Segue sua proposta',
        files: {
          sent: ['proposta.pdf'],
          failed: [{ name: 'anexo.png', reason: 'unavailable' }],
        },
      }),
    ).toBe(
      'De: 5599\nPara: 551\nMensagem: Segue sua proposta\n' +
        'Arquivos enviados: proposta.pdf\n' +
        'Arquivos não enviados: anexo.png (não foi possível obter o arquivo)',
    )
  })

  it('robô de envio com todos os arquivos falhando omite a linha de enviados', () => {
    expect(
      timelineNotices('pt').sendRobot.result({
        fromPhone: '5599',
        sent: ['551'],
        message: 'Segue',
        files: {
          sent: [],
          failed: [
            { name: 'a.pdf', reason: 'send_failed' },
            { name: 'b.mp4', reason: 'too_large' },
          ],
        },
      }),
    ).toBe(
      'De: 5599\nPara: 551\nMensagem: Segue\n' +
        'Arquivos não enviados: a.pdf (falha no envio), b.mp4 (maior que 30 MB)',
    )
  })

  it('robô de envio com arquivos em inglês e espanhol', () => {
    const input = {
      fromPhone: '5599',
      sent: ['551'],
      message: 'oi',
      files: {
        sent: ['proposta.pdf'],
        failed: [
          { name: 'x.png', reason: 'unavailable' as const },
          { name: 'y.pdf', reason: 'send_failed' as const },
        ],
      },
    }
    expect(timelineNotices('en').sendRobot.result(input)).toBe(
      'From: 5599\nTo: 551\nMessage: oi\n' +
        'Files sent: proposta.pdf\n' +
        'Files not sent: x.png (could not get the file), y.pdf (send failed)',
    )
    expect(timelineNotices('es').sendRobot.result(input)).toBe(
      'De: 5599\nPara: 551\nMensaje: oi\n' +
        'Archivos enviados: proposta.pdf\n' +
        'Archivos no enviados: x.png (no fue posible obtener el archivo), y.pdf (falla en el envío)',
    )
  })

  it('robô de envio só com arquivos omite a linha da mensagem', () => {
    expect(
      timelineNotices('pt').sendRobot.result({
        fromPhone: '5599',
        sent: ['551'],
        message: '',
        files: { sent: ['proposta.pdf'], failed: [] },
      }),
    ).toBe('De: 5599\nPara: 551\nArquivos enviados: proposta.pdf')
  })

  it('inglês e espanhol não repetem o português', () => {
    for (const name of Object.keys(CATALOGS)) {
      const catalog = CATALOGS[name]!
      const pt = strings(catalog('pt'))
      // Catálogo só de funções (conexão) é conferido pela saída, abaixo.
      if (pt.length === 0) continue
      expect(strings(catalog('en'))).not.toEqual(pt)
      expect(strings(catalog('es'))).not.toEqual(pt)
    }

    const connected = (locale: NoticeLocale) =>
      connectionNotices(locale).connected('WhatsApp 5511', 'INST')
    expect(connected('en')).not.toBe(connected('pt'))
    expect(connected('es')).not.toBe(connected('pt'))
  })
})
