export type PortalUserSummary = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export type ListPortalUsersResponse = {
  users: PortalUserSummary[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
