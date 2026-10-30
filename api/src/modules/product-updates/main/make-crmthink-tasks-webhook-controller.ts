import { env } from '@/config/env'
import { enqueueCrmthinkTaskSyncJob } from '@/queue/crmthink-task-sync.queue'
import { Controller } from '@/shared/presentation/controller'
import { CrmthinkTasksWebhookController } from '../presentation/controllers/crmthink-tasks-webhook.controller'
import { makeSyncCrmthinkTask } from './make-sync-crmthink-task'

/**
 * `POST /api/webhooks/crmthink-tasks`. A fila entra como função: quem consome é o
 * worker, noutro processo.
 */
export const makeCrmthinkTasksWebhookController = (): Controller =>
  new CrmthinkTasksWebhookController(
    makeSyncCrmthinkTask(),
    enqueueCrmthinkTaskSyncJob,
    env.crmthinkTasks.webhookToken,
    env.crmthinkTasks.syncEnabled,
  )
