export class PortalDomainNotFoundError extends Error {
  constructor() {
    super('Domain not found')
    this.name = 'PortalDomainNotFoundError'
  }
}
