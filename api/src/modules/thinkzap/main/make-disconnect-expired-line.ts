import { env } from '@/config/env'
import { DisconnectExpiredLine } from '@/modules/thinkzap/application/disconnect-expired-line'
import { ZApiClient } from '../infra/clients/z-api.client'
import { ZApiInstanceGateway } from '../infra/persistence/gateway/instance.gateway'
import { makeConnectorProviderResolver } from './make-connector-provider-resolver'

/**
 * Singleton de processo.
 *
 * O `DisconnectExpiredLine` guarda quais itens já foram desconectados com sucesso,
 * e esse memo é o que impede uma linha expirada de disparar `disconnect` a cada
 * requisição que a resolve. Uma instância nova por chamada zeraria o memo e
 * transformaria o efeito idempotente num efeito repetido.
 */
let instance: DisconnectExpiredLine | null = null

export function makeDisconnectExpiredLine(): DisconnectExpiredLine {
  if (instance) return instance

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  instance = new DisconnectExpiredLine(
    makeConnectorProviderResolver({
      zApiClient,
      instanceGateway: new ZApiInstanceGateway(zApiClient),
    }),
  )

  return instance
}
