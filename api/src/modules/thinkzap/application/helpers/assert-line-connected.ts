import { LineDisconnectedError } from '@/modules/thinkzap/domain/errors/line-disconnected.error'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { apiLogger } from '@/shared/infra/logger'

/** O mínimo que a checagem precisa da credencial resolvida da linha. */
export type ConnectedCheckTarget = {
  zApiInstanceId: string
  zApiInstanceToken: string
}

/**
 * Recusa a operação quando a linha está **comprovadamente** desconectada.
 *
 * "Comprovadamente" é a regra inteira: só lança quando a leitura do provider deu
 * certo e devolveu `connected === false`. Falha de leitura — Z-API fora, timeout —
 * vira `warn` e retorno silencioso, porque status indisponível não é o mesmo que
 * desconectado: recusar por um blip impediria um envio que teria funcionado, e no
 * pior caso o que acontece é o erro do provider aparecer, que é exatamente o
 * comportamento de antes desta checagem.
 *
 * Chamada **antes** de qualquer requisição de envio: descobrir a desconexão gastando
 * a requisição de envio custa o texto errado na tela do operador.
 */
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
    apiLogger.warn(
      { err: error, subscriptionItemId },
      'Não foi possível ler o status da linha; seguindo sem checar a conexão',
    )
    return
  }

  if (!connected) {
    throw new LineDisconnectedError(subscriptionItemId)
  }
}
