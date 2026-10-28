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

/**
 * Ação do backoffice que toca o provider (ou escreve no CRM compartilhado) num
 * ambiente com os efeitos de provider desligados — homologação. O portal Bitrix é o
 * mesmo de produção, então agir daqui mexeria em recurso de produção.
 */
export class ProviderEffectsDisabledError extends Error {
  readonly reason = 'provider-effects-disabled'

  constructor() {
    super('Efeitos de provider desligados neste ambiente')
    this.name = 'ProviderEffectsDisabledError'
  }
}
