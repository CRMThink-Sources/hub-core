import { describe, expect, it } from 'vitest'
import {
  NOTICE_LOCALES,
  dailyLimitNotices,
  parseNoticeLocale,
} from './daily-limit-notices'

describe('parseNoticeLocale', () => {
  it.each([
    ['pt', 'pt'],
    ['en', 'en'],
    ['es', 'es'],
    [null, 'pt'],
    [undefined, 'pt'],
    ['fr', 'pt'],
    ['EN', 'pt'],
  ])('%s → %s', (raw, expected) => {
    expect(parseNoticeLocale(raw)).toBe(expected)
  })
})

describe('dailyLimitNotices', () => {
  it('todo idioma tem todos os textos, com os dados interpolados', () => {
    for (const locale of NOTICE_LOCALES) {
      const notices = dailyLimitNotices(locale)

      expect(notices.chat).toMatch(/^⚠️ /)
      expect(notices.queuedRefused('5511999', 'Olá')).toContain('5511999')
      expect(notices.queuedRefused('5511999', 'Olá')).toContain('Olá')
      expect(notices.attachmentsSkipped(2)).toContain('2')
      expect(notices.robotRefused(['551', '552'])).toContain('551, 552')
    }
  })

  it('inglês e espanhol não repetem o texto em português', () => {
    const pt = dailyLimitNotices('pt').chat

    expect(dailyLimitNotices('en').chat).not.toBe(pt)
    expect(dailyLimitNotices('es').chat).not.toBe(pt)
    expect(dailyLimitNotices('en').chat).toContain('daily message limit')
    expect(dailyLimitNotices('es').chat).toContain('límite diario')
  })
})
