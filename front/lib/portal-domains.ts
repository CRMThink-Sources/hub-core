/** Resumo de uma assinatura da SPA 1142, como o portal admin a exibe. */
export type PortalAppSubscriptionSummary = {
  id: string
  status: string
  modality: string
  planName: string
  currentPeriodEnd: string
  lineCount: number
}

/**
 * Estado do bloco de contrato de uma instalação.
 *
 * Os três casos são distintos na tela de propósito: `no-mirror` é instalação sem espelho
 * na SPA 1060, `ok` com lista vazia é cliente que nunca contratou, e `unavailable` é o
 * CRM interno fora do ar — do qual nada se conclui sobre o cliente.
 */
export type PortalAppContract =
  | { status: 'ok'; subscriptions: PortalAppSubscriptionSummary[] }
  | { status: 'no-mirror' }
  | { status: 'unavailable' }

export type PortalDomainApp = {
  id: string
  appCodeId: string
  appCode: string
  appName: string
  /** Título do item espelho na SPA 1060 — o mesmo nome que o tenant vê. */
  title: string
  /** Id do item espelho na SPA 1060. `null` = instalação sem espelho. */
  spaId: string | null
  status: string
  email: string
  installedAt: string
  /** Só no detalhe do cliente: a listagem não resolve contrato. */
  contract?: PortalAppContract
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

/** Item de uma assinatura, na aba Assinaturas. Sem credencial: a api não a serializa. */
export type AppSubscriptionItem = {
  id: string
  name: string
  status: string
  metadata: {
    provider: string
    zApiInstanceId?: string
    hubmessageChannelId?: string
  }
}

export type AppSubscription = {
  id: string
  name: string
  status: string
  modality: string
  currentPeriodStart: string
  currentPeriodEnd: string
  planName: string
  productName: string
  gatewayId?: string
  items: AppSubscriptionItem[]
}

export type ListAppSubscriptionsResponse = {
  /** `false` = instalação sem espelho na SPA 1060, distinto de "sem contrato". */
  mirrored: boolean
  subscriptions: AppSubscription[]
}
