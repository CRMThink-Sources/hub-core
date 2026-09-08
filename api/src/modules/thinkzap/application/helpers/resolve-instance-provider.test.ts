import { describe, expect, it } from 'vitest'
import { resolveInstanceProvider } from './resolve-instance-provider'

describe('resolveInstanceProvider', () => {
  it('resolve HUBMESSAGE quando channelId está preenchido', () => {
    expect(resolveInstanceProvider({ channelId: 'CHANNEL-1' })).toBe(
      'HUBMESSAGE',
    )
  })

  it('resolve ZAPI quando channelId está ausente', () => {
    expect(resolveInstanceProvider({ channelId: null })).toBe('ZAPI')
  })
})
