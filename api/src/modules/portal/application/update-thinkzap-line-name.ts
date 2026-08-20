import { AppContextDeps } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { resolveAdminLine } from './helpers/resolve-admin-line'
import { zApiClient, zApiCredential } from './subscribe-thinkzap-line'

/**
 * Renomeia a instância **no Z-API**.
 *
 * Só existe para `ZAPI`: a HubMessage não expõe escrita de nome de canal — nem leitura
 * de canal, por isso o rótulo da linha oficial vem do banco (`hubMessageConnectorLabel`).
 * Recusa antes de qualquer chamada de rede, nomeando o provider, para o suporte não
 * concluir que o Z-API está fora quando a operação simplesmente não se aplica.
 */
export async function updateThinkzapLineName(
  appId: string,
  subscriptionItemId: string,
  name: string,
  deps?: AppContextDeps,
): Promise<void> {
  const item = await resolveAdminLine(appId, subscriptionItemId, deps)

  if (item.metadata.provider !== 'ZAPI') {
    throw new LineProviderNotSupportedError(item.metadata.provider)
  }

  const { instanceId, token } = zApiCredential(item)
  await zApiClient().updateInstance(instanceId, name, token)
}
