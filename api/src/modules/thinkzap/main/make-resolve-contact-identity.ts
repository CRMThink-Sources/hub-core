import { env } from '@/config/env'
import {
  resolveZApiContactIdentity,
  type ResolvedContactIdentity,
} from '@/modules/thinkzap/application/resolve-zapi-contact-identity'
import { PrismaContactIdentityRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-contact-identity.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export type ResolveContactIdentityInput = {
  event: { phone: string; chatLid?: string | null; senderLid?: string | null }
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

  return input =>
    resolveZApiContactIdentity(input.event, input.instanceDbId, {
      identityRepo,
      /**
       * Sem token não há como consultar a Z-API — o elo cai fora da cadeia em vez de
       * estourar. Acontece em linha cuja credencial não está preenchida, e a resolução
       * segue pelos elos que já estão no payload.
       */
      phoneExists: async phone => {
        if (!input.zApiToken) return null
        return new ZApiClient(
          env.zApi.partnerToken,
          env.zApi.clientToken,
        ).phoneExists(input.zApiInstanceId, input.zApiToken, phone)
      },
      useLidIdentity: env.thinkzapZApiLidIdentity,
    })
}
