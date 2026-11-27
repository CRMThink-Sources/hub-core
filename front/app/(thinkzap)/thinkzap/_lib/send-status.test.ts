import { describe, expect, it } from 'vitest'
import { SEND_STATUSES, isSendStatus, sendStatusView } from './send-status'

describe('sendStatusView', () => {
  it.each(SEND_STATUSES)('%s tem rótulo, tom e classes', status => {
    const view = sendStatusView(status)
    expect(view.labelKey).toBe(`status.${status.toLowerCase()}`)
    expect(view.tone).toBeTruthy()
    expect(view.badgeClassName).not.toBe('')
  })

  it('os sete estados são distintos pelo rótulo', () => {
    const keys = new Set(SEND_STATUSES.map(s => sendStatusView(s).labelKey))
    expect(keys.size).toBe(7)
  })

  it('falha é danger e não confirmado é warning', () => {
    expect(sendStatusView('FAILED').tone).toBe('danger')
    expect(sendStatusView('UNKNOWN').tone).toBe('warning')
    expect(sendStatusView('PARTIAL').tone).toBe('warning')
  })

  it('estado fora da lista cai em UNKNOWN', () => {
    expect(sendStatusView('NOVO')).toBe(sendStatusView('UNKNOWN'))
    expect(isSendStatus('NOVO')).toBe(false)
    expect(isSendStatus('READ')).toBe(true)
  })
})
