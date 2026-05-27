import { describe, expect, it } from 'vitest'
import {
  buildThinkzapAuthorizeUrl,
  parseBitrixDomain,
  resolveDialogId,
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

  it('resolves dialog id from query or url params', () => {
    const params = new URLSearchParams('DIALOG_ID=chat1')
    expect(resolveDialogId(params, {})).toBe('chat1')
    expect(resolveDialogId(new URLSearchParams(), { DIALOG_ID: 'chat2' })).toBe(
      'chat2',
    )
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
