import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { validateImbotIframeAuth } from './validate-imbot-iframe-auth'

describe('validateImbotIframeAuth', () => {
  const hash = '0e9c40cee01d6f182e9261b38b30b5c3'
  const domain = 'https://crmthink.bitrix24.com.br'
  const userId = '2'

  it('accepts valid domain and user hashes', () => {
    const domainHash = createHash('md5')
      .update(`crmthink.bitrix24.com.br${hash}`)
      .digest('hex')
    const userHash = createHash('md5').update(`${userId}${hash}`).digest('hex')

    expect(
      validateImbotIframeAuth({
        domain,
        userId,
        userHash,
        domainHash,
        hash,
      }),
    ).toBe(true)
  })

  it('rejects invalid hashes', () => {
    expect(
      validateImbotIframeAuth({
        domain,
        userId,
        userHash: 'invalid',
        domainHash: 'invalid',
        hash,
      }),
    ).toBe(false)
  })

  it('rejects when iframe hash is not configured', () => {
    expect(
      validateImbotIframeAuth({
        domain,
        userId,
        userHash: 'abc',
        domainHash: 'def',
        hash: '',
      }),
    ).toBe(false)
  })
})
