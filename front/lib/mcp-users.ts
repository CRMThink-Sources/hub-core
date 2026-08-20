export type McpUserSummary = {
  id: string
  name: string
  email: string
  domainId: string
  domainName: string
  isAdmin: boolean
  isActive: boolean
  createdAt: string
}

export type ListMcpUsersResponse = {
  users: McpUserSummary[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
