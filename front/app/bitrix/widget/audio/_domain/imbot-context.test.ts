import { describe, expect, it } from 'vitest'
import {
  buildThinkzapAuthorizeUrl,
  hasUploadAuth,
  parseBitrixDomain,
  parsePlacementOptions,
  resolveDialogId,
  resolveDialogIdFromPlacementOptions,
  resolveImbotAuth,
} from './imbot-context'

describe('imbot-context', () => {
  it('parses bitrix domain from url', () => {
    expect(parseBitrixDomain('https://crmthink.bitrix24.com.br/path')).toBe(
      'crmthink.bitrix24.com.br',
    )
  })

  it('resolves imbot auth from url params', () => {
    expect(
      resolveImbotAuth({
        USER_ID: '2',
        USER_HASH: 'abc',
        DOMAIN_HASH: 'def',
      }),
    ).toEqual({
      userId: '2',
      userHash: 'abc',
      domainHash: 'def',
    })
  })

  it('parses placement options json', () => {
    expect(
      parsePlacementOptions(JSON.stringify({ dialogId: 'chat99' })),
    ).toEqual({ dialogId: 'chat99' })
  })

  it('resolves dialog id from placement options', () => {
    expect(resolveDialogIdFromPlacementOptions({ dialogId: 'line42' })).toBe(
      'line42',
    )
  })

  it('resolves dialog id from query, url params or placement info', () => {
    const params = new URLSearchParams('DIALOG_ID=chat1')
    expect(resolveDialogId(params, {})).toBe('chat1')
    expect(resolveDialogId(new URLSearchParams(), { DIALOG_ID: 'chat2' })).toBe(
      'chat2',
    )
    expect(
      resolveDialogId(new URLSearchParams(), {
        PLACEMENT_OPTIONS: JSON.stringify({ dialogId: 'chat3' }),
      }),
    ).toBe('chat3')
    expect(
      resolveDialogId(new URLSearchParams(), {}, undefined, {
        placement: 'IM_TEXTAREA',
        options: { dialogId: 'chat4' },
      }),
    ).toBe('chat4')
  })

  it('detects upload auth from imbot or access token', () => {
    expect(hasUploadAuth(null, null)).toBe(false)
    expect(
      hasUploadAuth({ userId: '1', userHash: 'a', domainHash: 'b' }, null),
    ).toBe(true)
    expect(hasUploadAuth(null, 'token')).toBe(true)
  })

  it('builds marketplace authorize url', () => {
    expect(
      buildThinkzapAuthorizeUrl(
        'crmthink.bitrix24.com.br',
        'crmthink.thinkzap',
      ),
    ).toBe(
      'https://crmthink.bitrix24.com.br/marketplace/app/crmthink.thinkzap/',
    )
  })
})
