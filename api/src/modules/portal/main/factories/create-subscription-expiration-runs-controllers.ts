import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import {
  makeStartManualSubscriptionExpiration,
  makeSubscriptionExpirationRunRepository,
} from '@/modules/application/main/make-run-subscription-expiration'
import {
  crmOriginFromWebhook,
  GetSubscriptionExpirationRun,
  ListSubscriptionExpirationRuns,
} from '../../application/subscription-expiration-runs'
import {
  GetSubscriptionExpirationRunController,
  ListSubscriptionExpirationRunsController,
  StartSubscriptionExpirationRunController,
} from '../../presentation/controllers/subscription-expiration-runs-controller'

export const createListSubscriptionExpirationRunsController = (): Controller =>
  new ListSubscriptionExpirationRunsController(
    new ListSubscriptionExpirationRuns(
      makeSubscriptionExpirationRunRepository(),
    ),
  )

export const createGetSubscriptionExpirationRunController = (): Controller =>
  new GetSubscriptionExpirationRunController(
    new GetSubscriptionExpirationRun(
      makeSubscriptionExpirationRunRepository(),
      crmOriginFromWebhook(env.crmthinkWebhookUrl),
      env.payments.spa.subscriptionEntityType,
    ),
  )

export const createStartSubscriptionExpirationRunController = (): Controller =>
  new StartSubscriptionExpirationRunController(
    makeStartManualSubscriptionExpiration(),
  )
