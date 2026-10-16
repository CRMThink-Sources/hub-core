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
