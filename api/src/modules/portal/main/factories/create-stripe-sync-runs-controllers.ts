import { env } from '@/config/env'
import { Controller } from '@/shared/presentation/controller'
import {
  makeStartManualStripeSync,
  makeStripeSyncRunRepository,
} from '@/modules/thinkzap/main/make-stripe-sync'
import { crmOriginFromWebhook } from '../../application/subscription-expiration-runs'
import {
  GetStripeSyncRun,
  ListStripeSyncRuns,
} from '../../application/stripe-sync-runs'
import {
  GetStripeSyncRunController,
  ListStripeSyncRunsController,
  StartStripeSyncRunController,
} from '../../presentation/controllers/stripe-sync-runs-controller'

export const createListStripeSyncRunsController = (): Controller =>
  new ListStripeSyncRunsController(
    new ListStripeSyncRuns(makeStripeSyncRunRepository()),
  )

export const createGetStripeSyncRunController = (): Controller =>
  new GetStripeSyncRunController(
    new GetStripeSyncRun(
      makeStripeSyncRunRepository(),
      crmOriginFromWebhook(env.crmthinkWebhookUrl),
      env.payments.spa.subscriptionEntityType,
      env.payments.spa.subscriptionItemEntityType,
    ),
  )

export const createStartStripeSyncRunController = (): Controller =>
  new StartStripeSyncRunController(makeStartManualStripeSync())
