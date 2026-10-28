import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixSubscriptionStatusCounter } from '@/modules/application/infra/bitrix/readers/bitrix-subscription-status.counter'
import { CachedSubscriptionStatusCounter } from '@/modules/application/infra/cache/cached-subscription-status.counter'
import { GetDashboardSummary } from '../../application/get-dashboard-summary'
import { PrismaPortalDomainReadRepository } from '../../infra/persistence/prisma-portal-domain-read.repository'
import { GetDashboardSummaryController } from '../../presentation/controllers/get-dashboard-summary-controller'

/** A SPA 1142 vive no CRM interno da CRMThink, como na varredura de expiração. */
export const createGetDashboardSummaryController = (): Controller =>
  new GetDashboardSummaryController(
    new GetDashboardSummary(
      new PrismaPortalDomainReadRepository(),
      new CachedSubscriptionStatusCounter(
        new BitrixSubscriptionStatusCounter(
          new BitrixClient({ webhook: env.crmthinkWebhookUrl }),
        ),
        redisConnection,
      ),
    ),
  )
