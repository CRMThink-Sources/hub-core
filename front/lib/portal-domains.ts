export type PortalDomainApp = {
  id: string
  appCode: string
  appName: string
  status: string
  email: string
  installedAt: string
}

export type PortalDomainDetail = {
  id: string
  name: string
  memberId: string
  createdAt: string
  updatedAt: string
  apps: PortalDomainApp[]
}

export type ListPortalDomainsResponse = {
  domains: PortalDomainDetail[]
  total: number
}
