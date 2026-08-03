import { env } from '@/config/env'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { ZApiClient } from '../infra/clients/z-api.client'

/**
 * Dependências das operações de grupo.
 *
 * `connectorRepository` saiu: a linha é resolvida pelo item de assinatura, via
 * contexto da aplicação. `Connector` não participa mais.
 *
 * `instanceRepository` também saiu: o estado de conexão vem de `getInstance` na
 * Z-API, não de `Instance.status` — ver `resolveZApiInstance`. Grupos não leem
 * nada persistido.
 */
export function makeGroupZApiDeps() {
  return {
    getAplicationContext: makeGetAplicationContext(),
    zApiClient: new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
  }
}
