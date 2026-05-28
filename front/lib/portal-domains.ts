export type PortalDomainApp = {
  id: string
  appCodeId: string
  appCode: string
  appName: string
  status: string
  email: string
  installedAt: string
}

export const THINKZAP_APP_CODE_ID = 'crmthink.thinkzap'

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
