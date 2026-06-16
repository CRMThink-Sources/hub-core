export class PortalSubscriptionNotFoundError extends Error {
  constructor() {
    super('Subscription not found')
    this.name = 'PortalSubscriptionNotFoundError'
  }
}

export class PortalAppNotFoundError extends Error {
  constructor() {
    super('App not found')
    this.name = 'PortalAppNotFoundError'
  }
}

export class PortalDomainNotFoundError extends Error {
  constructor() {
    super('Domain not found')
    this.name = 'PortalDomainNotFoundError'
  }
}

export class ThinkzapNotInstalledError extends Error {
  constructor() {
    super('ThinkZap is not installed on this domain')
    this.name = 'ThinkzapNotInstalledError'
  }
}

export class DomainCredentialMissingError extends Error {
  constructor() {
    super('Domain credential is missing or has no access token')
    this.name = 'DomainCredentialMissingError'
  }
}
