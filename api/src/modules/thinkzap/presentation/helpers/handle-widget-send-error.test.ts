import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { thinkzapError } from '@/modules/thinkzap/errors/catalog'
import { mapWidgetSendError } from './handle-widget-send-error'

describe('mapWidgetSendError', () => {
  it('limite diário atingido vira 429 com code próprio', () => {
    const response = mapWidgetSendError(
      thinkzapError('thinkzap.line.daily_limit_reached'),
    )

    expect(response.status).toBe(429)
    expect(response.result).toMatchObject({ code: 'daily-limit-reached' })
  })

  it('falha genérica continua 400', () => {
    expect(mapWidgetSendError(new Error('boom')).status).toBe(400)
  })
})
