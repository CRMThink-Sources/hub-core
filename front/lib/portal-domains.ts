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

/**
 * Vínculo da instalação com o espelho na SPA 1060. `mirror-missing` só sai de uma
 * leitura que respondeu sem o item; leitura que falhou é `unknown`.
 */
export type PortalAppMirror =
  | 'linked'
  | 'no-mirror'
  | 'mirror-missing'
  | 'unknown'

export type PortalDomainApp = {
  id: string
  appCodeId: string
  appCode: string
  appName: string
  /** Título do item espelho na SPA 1060 — o mesmo nome que o tenant vê. */
  title: string
  /** Id do item espelho na SPA 1060. `null` = instalação sem espelho. */
  spaId: string | null
  mirror: PortalAppMirror
  status: string
  email: string
  installedAt: string
  /** Só no detalhe do cliente: a listagem não resolve contrato. */
  contract?: PortalAppContract
}

export const THINKZAP_APP_CODE_ID = 'crmthink.thinkzap'

/** Indicadores do topo do detalhe do cliente. */
export type PortalDomainSummary = {
  apps: number
  activeSubscriptions: number
  lines: number
  mcpUsers: number
  /** Algum contrato veio indisponível: assinaturas e linhas são um piso, não o total. */
  incomplete: boolean
}

export type PortalDomainDetail = {
  id: string
  name: string
  memberId: string
  createdAt: string
  updatedAt: string
  mcpUserCount: number
  apps: PortalDomainApp[]
  /** Só no detalhe do cliente. */
  summary?: PortalDomainSummary
}

export type ListPortalDomainsResponse = {
  domains: PortalDomainDetail[]
  total: number
}

/** `GET /portal/apps/:appId`: cabeçalho da tela de aplicação. */
export type PortalAppDetail = Omit<PortalDomainApp, 'contract'> & {
  locale: string | null
  domain: { id: string; name: string; memberId: string }
}

/** O que a marca do espelho do recurso diz sobre a cobrança da linha no provider. */
export type ProviderBilling = 'subscribed' | 'unsubscribed' | 'unknown'

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
  /** A credencial que o provider exige está preenchida. */
  hasCredential: boolean
  providerBilling: ProviderBilling
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
  /** `false` em homologação: ações de assinatura e de provider ficam desabilitadas. */
  providerEffectsEnabled: boolean
  subscriptions: AppSubscription[]
}

/** Resposta de ativar/inativar. */
export type SubscriptionStatusActionResponse = {
  id: string
  status: string
  currentPeriodEnd: string
}

/** Resposta de "Assinar todas no provider". */
export type SubscribeLinesResponse = {
  items: number
  subscribed: number
  unsubscribed: number
  failed: number
  ignored: number
}

/** Resposta de "Vincular espelho". */
export type LinkMirrorResponse = { spaId: string; mirror: 'linked' }

/** Motivos de recusa que a api devolve em `409`/`422` das ações do backoffice. */
export type BackofficeRefusalReason =
  | 'provider-effects-disabled'
  | 'gateway-managed'
  | 'already-active'
  | 'already-cancelled'
  | 'period-end-required'
  | 'period-end-invalid'
  | 'already-linked'
  | 'unverified'
  | 'not-found'
  | 'ambiguous'
  | 'taken'

export type PortalErrorInfo = {
  status?: number
  reason?: string
  ids: string[]
  message?: string
}

/**
 * Lê o corpo de erro da api do portal (`{ result: { error, reason?, ids? } }`), que o
 * axios deixa em `error.response.data`. Nunca lança: corpo inesperado vira só o status.
 */
export function readPortalError(error: unknown): PortalErrorInfo {
  const response = (
    error as { response?: { status?: unknown; data?: unknown } }
  )?.response
  const status =
    typeof response?.status === 'number' ? response.status : undefined
  const result = (response?.data as { result?: unknown } | undefined)?.result
  const body = (result ?? {}) as {
    error?: unknown
    reason?: unknown
    ids?: unknown
  }

  return {
    status,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    ids: Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : [],
    message: typeof body.error === 'string' ? body.error : undefined,
  }
}
