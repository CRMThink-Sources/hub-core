import { describe, expect, it } from 'vitest'
import { NOTICE_LOCALES } from './notice-locale'
import { timelineNotices } from './timeline-notices'

describe('avisos de destino não resolvido dos robôs', () => {
  const token = '{{{Contato: Celular}}}'

  it.each(NOTICE_LOCALES)(
    'robô de template em %s cita o valor recebido como veio',
    locale => {
      const { templateRobot } = timelineNotices(locale)

      expect(templateRobot.destinationUnresolved(token)).toContain(token)
      expect(templateRobot.destinationEmpty.length).toBeGreaterThan(20)
    },
  )

  it.each(NOTICE_LOCALES)(
    'robô de botões em %s cita o valor recebido como veio',
    locale => {
      const { buttonRobot } = timelineNotices(locale)

      expect(buttonRobot.destinationUnresolved(token)).toContain(token)
      expect(buttonRobot.destinationEmpty.length).toBeGreaterThan(20)
    },
  )

  it('cada idioma tem texto próprio, distinto do português', () => {
    const pt = timelineNotices('pt').templateRobot
    const en = timelineNotices('en').templateRobot
    const es = timelineNotices('es').templateRobot

    expect(en.destinationEmpty).not.toBe(pt.destinationEmpty)
    expect(es.destinationEmpty).not.toBe(pt.destinationEmpty)
    expect(en.destinationUnresolved(token)).not.toBe(
      pt.destinationUnresolved(token),
    )
    expect(es.destinationUnresolved(token)).not.toBe(
      pt.destinationUnresolved(token),
    )
  })

  it('os dois robôs usam o mesmo texto para o mesmo problema', () => {
    const notices = timelineNotices('pt')

    expect(notices.buttonRobot.destinationEmpty).toBe(
      notices.templateRobot.destinationEmpty,
    )
  })
})
