import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { redisConnection } from '@/queue/redis-connection'
import { InvalidateSpaCache } from '@/modules/application/application/invalidate-spa-cache'
import { BitrixAplicationTitleReader } from '@/modules/application/infra/bitrix/readers/bitrix-aplication-title.reader'
import { BitrixSpaParentReader } from '@/modules/application/infra/bitrix/readers/bitrix-spa-parent.reader'
import { findAplicationSpaItems } from '@/modules/application/infra/bitrix/readers/find-aplication-spa-items'
import { PrismaAplicationRepository } from '@/modules/application/infra/prisma/repositories/prisma-aplications.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { LinkAplicationMirror } from '../../application/link-aplication-mirror'
import { PrismaPortalAppReadRepository } from '../../infra/persistence/prisma-portal-app-read.repository'
import { LinkAplicationMirrorController } from '../../presentation/controllers/link-aplication-mirror-controller'

export const createLinkAplicationMirrorController = (): Controller => {
  const bitrix = new BitrixClient({ webhook: env.crmthinkWebhookUrl })
  const mirrors = new BitrixAplicationTitleReader(bitrix)
  const invalidate = new InvalidateSpaCache(
    redisConnection,
    new BitrixSpaParentReader(bitrix),
  )

  return new LinkAplicationMirrorController(
    new LinkAplicationMirror({
      apps: new PrismaPortalAppReadRepository(),
      mirrors,
      findItems: async (domain, appCodeId) => {
        const byDomain = await findAplicationSpaItems(bitrix, appCodeId, [
          domain,
        ])
        return [...byDomain.values()].flat()
      },
      aplications: new PrismaAplicationRepository(prisma, mirrors),
      // Mesmo efeito do UPDATE da SPA 1060 no webhook: a família de assinatura guarda a
      // aplicação hidratada, e o vínculo novo muda o que ela deveria conter.
      invalidateCache: async spaId => {
        await invalidate.execute({
          entityTypeId: env.payments.spa.aplicationEntityType,
          itemId: spaId,
          verb: 'UPDATE',
        })
      },
    }),
  )
}
