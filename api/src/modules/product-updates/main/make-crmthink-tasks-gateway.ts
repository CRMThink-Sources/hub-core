import { env } from '@/config/env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type {
  CrmthinkTasksConfig,
  CrmthinkTasksGateway,
} from '../domain/ports/crmthink-tasks-gateway.port'
import type { CreateCrmthinkTaskConfig } from '../application/create-crmthink-task-for-update'
import {
  BitrixCrmthinkTasksGateway,
  toRestV3Webhook,
} from '../infra/adapters/bitrix-crmthink-tasks-gateway.adapter'

/**
 * Gateway das tarefas pelo webhook de entrada do portal da CRMThink
 * (`CRMTHINK_WEBHOOK_URL`). Sem a URL, toda chamada falha como indisponível (`502`).
 */
export function makeCrmthinkTasksGateway(
  webhookUrl: string = env.crmthinkWebhookUrl,
): CrmthinkTasksGateway {
  return new BitrixCrmthinkTasksGateway(
    new BitrixClient({ webhook: webhookUrl }),
    new BitrixClient({ webhook: toRestV3Webhook(webhookUrl) }),
  )
}

/** `env.crmthinkTasks` no formato que os casos de uso recebem. */
export function makeCrmthinkTasksConfig(): CrmthinkTasksConfig {
  return {
    syncEnabled: env.crmthinkTasks.syncEnabled,
    groupId: env.crmthinkTasks.groupId,
  }
}

/** Idem, com a origem do front para o link da novidade na descrição da tarefa. */
export function makeCreateCrmthinkTaskConfig(): CreateCrmthinkTaskConfig {
  return { ...makeCrmthinkTasksConfig(), backofficeBaseUrl: env.frontUrl }
}
