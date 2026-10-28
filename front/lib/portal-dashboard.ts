import { axiosPortal } from '@/infra/client/axios-portal'

export type DashboardSummary = {
  clients: number
  /** `null` quando a contagem no CRM falhou: os cards de assinatura ficam indisponíveis. */
  subscriptions: {
    active: number
    pastDue: number
    trialing: number
  } | null
  /** ISO: quando as assinaturas foram contadas (até 60 s de cache). */
  generatedAt: string
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return axiosPortal().get<DashboardSummary>('/portal/dashboard/summary')
}
