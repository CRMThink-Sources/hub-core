import type { AdminStatusTone } from '@/components/layouts/admin/ui/admin-status-badge'

/**
 * Status do backoffice de clientes → tom do badge + chave de rótulo no namespace
 * `admin/status`.
 *
 * Um mapa só, para as três telas: listagem, cliente e aplicação mostrarem o mesmo
 * status com o mesmo texto e a mesma cor. Valor fora do mapa cai em `unknown` (tom
 * neutro), nunca no valor cru do enum — `past_due` na tela é o que o suporte não
 * deveria ter que traduzir de cabeça.
 */
export type StatusMeta = { tone: AdminStatusTone; labelKey: string }

export const STATUS_NAMESPACE = 'admin/status'

const UNKNOWN: StatusMeta = { tone: 'neutral', labelKey: 'unknown' }

export const SUBSCRIPTION_STATUS: Record<string, StatusMeta> = {
  active: { tone: 'success', labelKey: 'subscription.active' },
  past_due: { tone: 'warning', labelKey: 'subscription.past_due' },
  trialing: { tone: 'info', labelKey: 'subscription.trialing' },
  trial_expired: { tone: 'neutral', labelKey: 'subscription.trial_expired' },
  cancelled: { tone: 'danger', labelKey: 'subscription.cancelled' },
}

export const APP_STATUS: Record<string, StatusMeta> = {
  ACTIVE: { tone: 'success', labelKey: 'app.ACTIVE' },
  INACTIVE: { tone: 'neutral', labelKey: 'app.INACTIVE' },
  SUSPENDED: { tone: 'warning', labelKey: 'app.SUSPENDED' },
  TRIAL: { tone: 'info', labelKey: 'app.TRIAL' },
}

export const MIRROR_STATUS: Record<string, StatusMeta> = {
  linked: { tone: 'success', labelKey: 'mirror.linked' },
  'no-mirror': { tone: 'warning', labelKey: 'mirror.no-mirror' },
  'mirror-missing': { tone: 'danger', labelKey: 'mirror.mirror-missing' },
  unknown: { tone: 'neutral', labelKey: 'mirror.unknown' },
}

export const PROVIDER_BILLING_STATUS: Record<string, StatusMeta> = {
  subscribed: { tone: 'success', labelKey: 'providerBilling.subscribed' },
  unsubscribed: { tone: 'neutral', labelKey: 'providerBilling.unsubscribed' },
  unknown: { tone: 'neutral', labelKey: 'providerBilling.unknown' },
}

export const LINE_STATUS: Record<string, StatusMeta> = {
  active: { tone: 'success', labelKey: 'line.active' },
  cancelled: { tone: 'neutral', labelKey: 'line.cancelled' },
}

/** Só rótulo: modalidade não é status, não ganha cor. */
export const MODALITY_LABEL: Record<string, string> = {
  stripe: 'modality.stripe',
  manual: 'modality.manual',
}

export const statusMeta = (
  map: Record<string, StatusMeta>,
  value: string,
): StatusMeta => map[value] ?? UNKNOWN

export const modalityLabelKey = (modality: string): string =>
  MODALITY_LABEL[modality] ?? 'unknown'
