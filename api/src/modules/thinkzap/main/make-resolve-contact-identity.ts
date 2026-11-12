import { env } from '@/config/env'
import {
  resolveZApiContactIdentity,
  type ResolvedContactIdentity,
} from '@/modules/thinkzap/application/resolve-zapi-contact-identity'
import { resolveReplyChatRoute } from '@/modules/thinkzap/application/resolve-reply-chat-route'
import { PrismaContactIdentityRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-contact-identity.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { apiLogger } from '@/shared/infra/logger'

export type ResolveContactIdentityInput = {
  event: {
    phone: string
    chatLid?: string | null
    senderLid?: string | null
    /** Mensagem citada: se foi enviada pelo widget, a resposta cai na conversa dela. */
    referenceMessageId?: string | null
  }
  /** `Instance.id` — o escopo do mapa. */
  instanceDbId: string
  /** Id da instância **na Z-API**, para a consulta a `phone-exists`. */
  zApiInstanceId: string
  zApiToken: string | null
}

/**
 * A resolução da identidade como porta, e não como dependência de construtor do use
 * case: as credenciais da Z-API só são conhecidas depois de resolver a instância, então
 * quem monta o use case não tem como fornecer um cliente pronto.
 */
export type ResolveContactIdentity = (
  input: ResolveContactIdentityInput,
) => Promise<ResolvedContactIdentity>

export function makeResolveContactIdentity(): ResolveContactIdentity {
  const identityRepo = new PrismaContactIdentityRepository()
  const messageRepo = new PrismaThinkzapMessageRepository()

  return async input => {
    const identity = await resolveZApiContactIdentity(
      input.event,
      input.instanceDbId,
      {
        identityRepo,
        /**
         * Sem token não há como consultar a Z-API — o elo cai fora da cadeia em vez de
         * estourar. Acontece em linha cuja credencial não está preenchida, e a resolução
         * segue pelos elos que já estão no payload.
         */
        phoneExists: async phone => {
          if (!input.zApiToken) {
            apiLogger.warn(
              {
                app: 'thinkzap',
                provider: 'ZAPI',
                operation: 'phoneExists',
                motivo: 'instancia_sem_token',
                instanceId: input.zApiInstanceId,
                phone,
              },
              'Z-API phone-exists não consultado: instância sem token',
            )
            return null
          }
          return new ZApiClient(
            env.zApi.partnerToken,
            env.zApi.clientToken,
          ).phoneExists(input.zApiInstanceId, input.zApiToken, phone)
        },
        useLidIdentity: env.thinkzapZApiLidIdentity,
      },
    )

    return resolveReplyChatRoute(
      {
        identity,
        referenceMessageId: input.event.referenceMessageId,
        instanceDbId: input.instanceDbId,
      },
      {
        identityRepo,
        findMessage: (instanceDbId, providerMessageId) =>
          messageRepo.findByProviderMessageId(instanceDbId, providerMessageId),
      },
    )
  }
}
