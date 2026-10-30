export type PortalUserRole = 'ADMIN'

export type PortalUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  role: PortalUserRole
  isActive: boolean
  /** ID do usuário no Bitrix24 da CRMThink; nulo quando não há vínculo. */
  bitrixUserId: number | null
  createdAt: Date
  updatedAt: Date
}

export type PortalSession = {
  id: string
  email: string
  name: string
  role: PortalUserRole
}
