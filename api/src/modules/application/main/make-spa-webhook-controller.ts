import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { redisConnection } from '@/queue/redis-connection'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'
import { UnlinkAplicationSpaItem } from '@/modules/application/application/unlink-aplication-spa-item'
import { BitrixSpaParentReader } from '@/modules/application/infra/bitrix/readers/bitrix-spa-parent.reader'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { SpaWebhookController } from '@/modules/application/presentation/controllers/spa-webhook.controller'
import { enqueueSpaItemProvisioningJob } from '@/queue/spa-item-provisioning.queue'
import {
  enqueueSpaItemCleanupJob,
  enqueueSpaItemStatusSyncJob,
  enqueueSubscriptionBillingSyncJob,
} from '@/queue/spa-item-resource-sync.queue'

/**
 * O `BitrixClient` aponta para o portal **interno** da CRMThink, onde as SPAs de
 * billing vivem — o mesmo de `makeGetAplicationContext`. O webhook de saída não
 * carrega token OAuth de instalação, e nem precisaria: a leitura do pai é sempre no
 * portal interno.
 */
export const makeSpaWebhookController = (): Controller => {
  const bitrixClient = new BitrixClient({ webhook: env.crmthinkWebhookUrl })

  const invalidate = new InvalidateSpaCache(
    redisConnection,
    new BitrixSpaParentReader(bitrixClient),
  )

  const unlink = new UnlinkAplicationSpaItem(
    new PrismaAplicationRepository(
      prisma,
      new BitrixAplicationTitleReader(bitrixClient),
    ),
  )

  /**
   * As filas entram como **funções**, e não os casos de uso: provisionamento, limpeza e
   * sincronização vivem no `thinkzap`, e injetar a fila é o que mantém `payments` sem
   * dependência dele. Quem consome os jobs é o worker, num processo próprio.
   *
   * O desvínculo é a exceção que confirma a regra: ele mexe em `core_apps`, que é deste
   * módulo, então o caso de uso é montado aqui mesmo — mas entra reduzido a uma função,
   * para o controller não ganhar acesso aos outros métodos do repositório.
   */
  return new SpaWebhookController(
    invalidate,
    env.bitrixSpaWebhookToken,
    {
      enqueueProvisioning: enqueueSpaItemProvisioningJob,
      enqueueCleanup: enqueueSpaItemCleanupJob,
      enqueueStatusSync: enqueueSpaItemStatusSyncJob,
      enqueueSubscriptionBillingSync: enqueueSubscriptionBillingSyncJob,
      unlinkAplicationSpaItem: itemId => unlink.execute(itemId),
    },
    env.payments.spa.providerEffectsEnabled,
  )
}
