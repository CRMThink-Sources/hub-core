export class McpUserAlreadyExistsError extends Error {
  constructor() {
    super('MCP user already exists')
    this.name = 'McpUserAlreadyExistsError'
  }
}

export class McpUserNotFoundError extends Error {
  constructor() {
    super('MCP user not found')
    this.name = 'McpUserNotFoundError'
  }
}

export class McpDomainNotFoundError extends Error {
  constructor() {
    super('Domain not found')
    this.name = 'McpDomainNotFoundError'
  }
}
