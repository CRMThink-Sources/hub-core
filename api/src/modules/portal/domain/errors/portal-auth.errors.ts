export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials')
    this.name = 'InvalidCredentialsError'
  }
}

export class InactivePortalUserError extends Error {
  constructor() {
    super('User account is inactive')
    this.name = 'InactivePortalUserError'
  }
}

export class PortalUserNotFoundError extends Error {
  constructor() {
    super('Portal user not found')
    this.name = 'PortalUserNotFoundError'
  }
}
