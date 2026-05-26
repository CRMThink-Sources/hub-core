import { describe, expect, it, vi } from 'vitest'
import { resolveAccessToken, resolveDialogId } from './audio-widget-auth'

describe('resolveDialogId', () => {
  it('returns DIALOG_ID from search params', () => {
    const params = new URLSearchParams('DIALOG_ID=chat123')

    expect(resolveDialogId(params, {})).toBe('chat123')
  })

  it('returns dialogId from PLACEMENT_OPTIONS json', () => {
    const params = new URLSearchParams()
    const urlParams = {
      PLACEMENT_OPTIONS: JSON.stringify({ dialogId: 'chat80619' }),
    }

    expect(resolveDialogId(params, urlParams)).toBe('chat80619')
  })

  it('prefers DIALOG_ID over PLACEMENT_OPTIONS', () => {
    const params = new URLSearchParams('DIALOG_ID=chat111')
    const urlParams = {
      PLACEMENT_OPTIONS: JSON.stringify({ dialogId: 'chat80619' }),
    }

    expect(resolveDialogId(params, urlParams)).toBe('chat111')
  })

  it('returns null when dialog id is unavailable', () => {
    expect(resolveDialogId(new URLSearchParams(), {})).toBeNull()
  })
})

describe('resolveAccessToken', () => {
  it('prioritizes getAuth access_token', () => {
    const getAuth = vi.fn(() => ({
      access_token: 'from-bx24',
      refresh_token: 'refresh',
      expires_in: 3600,
      domain: 'crmthink.bitrix24.com.br',
      member_id: 'member',
    }))

    expect(resolveAccessToken(getAuth, { AUTH_ID: 'from-url' })).toBe(
      'from-bx24',
    )
  })

  it('falls back to AUTH_ID from url params', () => {
    expect(resolveAccessToken(undefined, { AUTH_ID: 'from-url' })).toBe(
      'from-url',
    )
  })

  it('returns null when token is unavailable', () => {
    expect(resolveAccessToken(undefined, {})).toBeNull()
    expect(resolveAccessToken(() => false, {})).toBeNull()
  })
})
