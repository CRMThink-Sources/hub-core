import type { SubscriptionStatusCounter } from '@/modules/application/domain/repositories/subscription-status.counter'
import { apiLogger } from '@/shared/infra/logger'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'

export type DashboardSummary = {
  clients: number
  /** `null` quando a contagem no CRM falhou: a home mostra os cards como indisponíveis. */
  subscriptions: {
    active: number
    pastDue: number
    trialing: number
  } | null
  /** Instante da contagem das assinaturas (que pode vir de cache) ou, sem ela, agora. */
  generatedAt: Date
}

/**
 * Resumo da home do backoffice. Só leitura: clientes do banco e assinaturas da SPA
 * 1142 por status. A falha do CRM degrada só o bloco de assinaturas — clientes vêm
 * do banco e continuam aparecendo.
 */
export class GetDashboardSummary {
  constructor(
    private readonly domains: Pick<PortalDomainReadRepository, 'countAll'>,
    private readonly subscriptions: SubscriptionStatusCounter,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<DashboardSummary> {
    const [clients, counts] = await Promise.all([
      this.domains.countAll(),
      this.subscriptions.count().catch(error => {
        apiLogger.warn(
          { app: 'shared', err: error },
          'Painel do backoffice: contagem de assinaturas indisponível',
        )
        return null
      }),
    ])

    if (!counts) {
      return { clients, subscriptions: null, generatedAt: this.clock() }
    }

    const { countedAt, ...subscriptions } = counts
    return { clients, subscriptions, generatedAt: countedAt }
  }
}
