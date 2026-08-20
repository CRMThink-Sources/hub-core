import type IORedis from 'ioredis'
import { randomUUID } from 'node:crypto'

/**
 * TTL do lock. Precisa cobrir com folga o envio mais lento (provider + persistência),
 * e ser curto o bastante para que um worker morto não trave o destino por muito tempo.
 * Trinta segundos é a ordem do timeout de HTTP do provider, com margem.
 */
const LOCK_TTL_MS = 30_000

export type DestinationLock = {
  /** Libera o lock. Só remove se ainda for **este** dono — ver `release`. */
  release: () => Promise<void>
}

function lockKey(instanceId: string, destination: string): string {
  return `thinkzap:widget-send-lock:${instanceId}:${destination}`
}

/**
 * Serializa o envio por par `(linha, destino)`.
 *
 * Existe porque a fila roda com concorrência maior que 1: sem isto, duas mensagens
 * enfileiradas em sequência para o mesmo contato podem ser entregues invertidas, e ele
 * lê a resposta antes da pergunta. O problema **não existe hoje**, quando o envio é
 * síncrono — é risco introduzido pela fila, e por isso o lock nasce junto com ela.
 *
 * O escopo é o par, e não a fila inteira: serializar globalmente faria a mensagem para
 * o contato A esperar a do contato B, matando a vazão sem ganhar ordem nenhuma que
 * importe — ordem só é observável dentro de uma conversa.
 *
 * `null` quando o lock está tomado. O chamador **re-enfileira com atraso** em vez de
 * esperar: segurar um slot de concorrência bloqueado é como se transforma uma fila com
 * dez workers numa fila com um.
 */
export async function acquireDestinationLock(
  redis: IORedis,
  instanceId: string,
  destination: string,
): Promise<DestinationLock | null> {
  const key = lockKey(instanceId, destination)
  /**
   * Token por aquisição: é ele que impede um worker de liberar o lock de outro. Sem
   * isso, um worker lento cujo TTL expirou deletaria, ao terminar, o lock que o
   * próximo dono acabou de pegar — e os dois enviariam ao mesmo tempo.
   */
  const token = randomUUID()

  const acquired = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX')
  if (acquired !== 'OK') return null

  return {
    release: async () => {
      /**
       * Compare-and-delete atômico. `GET` seguido de `DEL` deixaria a janela entre as
       * duas operações aberta, que é exatamente onde o lock do próximo dono seria
       * apagado por engano.
       */
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `
      await redis.eval(script, 1, key, token)
    },
  }
}
