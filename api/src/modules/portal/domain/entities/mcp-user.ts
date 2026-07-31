export type McpUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  domainId: string
  isAdmin: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Linha da listagem já com o nome do domínio resolvido (join core_domains).
export type McpUserWithDomain = McpUser & {
  domainName: string
}
