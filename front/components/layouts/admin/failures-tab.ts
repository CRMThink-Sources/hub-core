export type FailureTab = 'outbox' | 'inbound'

/** Aba aberta por `?tab=`, para o link da página do cliente cair na aba certa. */
export const FAILURES_TAB_PARAM = 'tab'
/** Portal pré-filtrado por `?domain=`, o mesmo filtro do campo "Portal". */
export const FAILURES_DOMAIN_PARAM = 'domain'

/** Qualquer valor desconhecido cai em "Envio", a aba que já existia. */
export function resolveFailureTab(value: string | null): FailureTab {
  return value === 'inbound' ? 'inbound' : 'outbox'
}
