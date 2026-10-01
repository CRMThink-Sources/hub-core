import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

export type ConnectedCheckTarget = {
  zApiInstanceId: string
  zApiInstanceToken: string
}

// Só lança com `connected === false` lido; falha de leitura segue: indisponível ≠ desconectado.
export async function assertLineConnected(
  zApiClient: Pick<ZApiClient, 'getInstance'>,
  line: ConnectedCheckTarget,
  subscriptionItemId: string,
): Promise<void> {
  let connected: boolean

  try {
    const instance = await zApiClient.getInstance(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )
    connected = instance.connected
  } catch (error) {
    logThinkzapError(
      apiLogger,
      'thinkzap.zapi.instance_status_failed',
      { app: 'thinkzap', err: error, subscriptionItemId },
      {
        msg: 'Não foi possível ler o status da linha; seguindo sem checar a conexão',
      },
    )
    return
  }

  if (!connected) {
    throw new LineDisconnectedError(subscriptionItemId)
  }
}
