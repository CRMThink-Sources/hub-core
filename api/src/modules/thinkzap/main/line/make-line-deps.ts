import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'

/**
 * Dependências comuns das rotas de linha.
 *
 * `PrismaConnectorRepository` **não** está aqui: a resolução é pelo item de
 * assinatura, e `Connector` saiu do caminho. Se voltar a aparecer numa fábrica de
 * linha, é sinal de regressão.
 *
 * `instanceRepository` continua só pelo que ainda mora em `Instance`: o vínculo
 * de canal aberto. Ajustes não passam mais por lá — quem os grava é
 * `subscriptionItems`, no item da SPA.
 */
export function makeLineDeps() {
  return {
    getAplicationContext: makeGetAplicationContext(),
    subscriptionItems: makeSubscriptionItemRepository(),
    instanceRepository: new PrismaInstanceRepository(),
    zApiClient: new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
    /** WhatsApp Oficial: conexão do canal e status ao vivo da linha. */
    hubMessageClient: new HubMessageClient({
      baseUrl: env.hubMessage.baseUrl,
      token: env.hubMessage.secretKey,
    }),
  }
}
