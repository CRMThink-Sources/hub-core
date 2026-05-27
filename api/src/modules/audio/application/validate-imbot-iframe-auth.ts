import { createHash } from 'node:crypto'

export function parseBitrixDomain(value: string): string {
  return value.replace(/^https?:\/\//, '').split('/')[0] ?? ''
}

export function validateImbotIframeAuth(params: {
  domain: string
  userId: string
  userHash: string
  domainHash: string
  hash: string
}): boolean {
  if (!params.hash) return false

  const domainHost = parseBitrixDomain(params.domain)
  if (!domainHost) return false

  const expectedDomainHash = createHash('md5')
    .update(`${domainHost}${params.hash}`)
    .digest('hex')
  const expectedUserHash = createHash('md5')
    .update(`${params.userId}${params.hash}`)
    .digest('hex')

  return (
    params.domainHash === expectedDomainHash &&
    params.userHash === expectedUserHash
  )
}
