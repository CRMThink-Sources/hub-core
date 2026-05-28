export type PortalUserRole = 'ADMIN'

export type PortalUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  role: PortalUserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type PortalSession = {
  id: string
  email: string
  name: string
  role: PortalUserRole
}
