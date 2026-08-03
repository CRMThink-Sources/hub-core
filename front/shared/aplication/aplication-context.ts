import {
  deriveSubscriptionState,
  type SpaSubscriptionStatus,
  type SubscriptionItemStatus,
  type SubscriptionState,
} from '@/shared/billing/derive-subscription-state'

/**
 * Espelho do payload de `GET /api/application/me` (mapper de apresentação do
 * módulo `application` no api). Só os campos que o front consome.
 */
export type CustomerView = {
  id: string
  name: string
  memberId: string
}

export type AplicationView = {
  id: string
  spaId: string | null
  appCode: string
  title: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * `metadata` do item já redigido pelo api: identificadores do provider, **nunca**
 * `zApiInstanceToken` — o mapper de apresentação do backend o omite e tem teste
 * afirmando a ausência.
 */
export type SubscriptionItemMetadataView =
  | { provider: 'ZAPI'; zApiInstanceId: string }
  | { provider: 'HUBMESSAGE'; hubmessageChannelId: string; wabaId: string }
  | { provider: 'NONE' }

export type SubscriptionItemView = {
  id: string
  name: string
  status: SubscriptionItemStatus
  gatewayId?: string
  metadata: SubscriptionItemMetadataView
}

/** Subconjunto do plano que o front consome. O payload traz mais. */
export type PlanView = {
  id: string
  name: string
  amount: number
}

export type SubscriptionView = {
  id: string
  name: string
  status: SpaSubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  gatewayId?: string
  plan: PlanView
  items: SubscriptionItemView[]
}

export type AplicationContextPayload = {
  customer: CustomerView
  aplication: AplicationView
  subscriptions: SubscriptionView[]
}

/**
 * Estado do contexto da instalação.
 *
 * Discriminado de propósito: `error` e `not-found` **não** podem se confundir
 * com "carregado sem assinaturas". Um `502` virando `subscriptions: []` faria a
 * tela oferecer contratação a um cliente que já paga — é o motivo pelo qual o
 * backend responde `502` em vez de lista vazia (`aplication-context-query`), e
 * jogar isso fora aqui desfaria a proteção.
 */
export type AplicationContextState =
  | { status: 'unauthenticated' }
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      customer: CustomerView
      aplication: AplicationView
      subscriptions: SubscriptionView[]
      billing: SubscriptionState
    }

export type HttpOutcome =
  | { kind: 'ok'; data: unknown }
  | { kind: 'status'; status: number; message?: string }
  | { kind: 'network'; message: string }

const GENERIC_ERROR = 'Não foi possível carregar os dados da aplicação.'

function parsePayload(data: unknown): AplicationContextPayload | null {
  if (!data || typeof data !== 'object') return null
  const payload = data as Partial<AplicationContextPayload>
  if (!payload.customer?.id || !payload.aplication?.id) return null
  return {
    customer: payload.customer,
    aplication: payload.aplication,
    subscriptions: Array.isArray(payload.subscriptions)
      ? payload.subscriptions
      : [],
  }
}

/** Traduz o desfecho HTTP no estado do contexto. Sem React, sem efeito. */
export function toAplicationContextState(
  outcome: HttpOutcome,
): AplicationContextState {
  if (outcome.kind === 'network') {
    return { status: 'error', message: outcome.message || GENERIC_ERROR }
  }

  if (outcome.kind === 'status') {
    if (outcome.status === 401 || outcome.status === 403) {
      return { status: 'unauthenticated' }
    }
    if (outcome.status === 404) {
      return { status: 'not-found' }
    }
    return { status: 'error', message: outcome.message || GENERIC_ERROR }
  }

  const payload = parsePayload(outcome.data)
  if (!payload) {
    return { status: 'error', message: GENERIC_ERROR }
  }

  return {
    status: 'ready',
    customer: payload.customer,
    aplication: payload.aplication,
    subscriptions: payload.subscriptions,
    billing: deriveSubscriptionState(payload.subscriptions),
  }
}

/**
 * Carrega o contexto da instalação.
 *
 * Token ausente não dispara requisição: sem JWT a resposta seria `401` de todo
 * jeito, e o estado correto é "não autenticado" — o iframe do Bitrix reabre o
 * login.
 */
export async function loadAplicationContext(deps: {
  readToken: () => string | null
  request: (token: string) => Promise<HttpOutcome>
}): Promise<AplicationContextState> {
  const token = deps.readToken()
  if (!token) return { status: 'unauthenticated' }

  return toAplicationContextState(await deps.request(token))
}
