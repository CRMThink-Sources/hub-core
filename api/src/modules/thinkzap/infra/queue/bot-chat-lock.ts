import type IORedis from 'ioredis'
import { randomUUID } from 'node:crypto'

/**
 * TTL do lock. Cobre o turno mais lento (uma chamada a `dialog.get`, o passo do fluxo e
 * as falas), e é curto o bastante para um worker morto não travar o chat.
 */
const LOCK_TTL_MS = 30_000

export type BotChatLock = {
  /** Libera o lock. Só remove se ainda for **este** dono. */
  release: () => Promise<void>
}

function lockKey(appId: string, chatId: string): string {
  return `thinkzap:bot-chat-lock:${appId}:${chatId}`
}

/**
 * Serializa os turnos do bot por chat.
 *
 * Existe porque o Bitrix dispara `ONIMBOTV2MESSAGEADD` e `ONIMBOTV2JOINCHAT` no mesmo
 * instante quando o contato abre a conversa — medido em produção com 4 ms entre os dois
 * — e a fila roda com `concurrency: 10`. Os dois jobs entravam em paralelo, **nenhum
 * via a sessão do outro**, e os dois rodavam o fluxo do início: o cliente recebia a
 * saudação duas vezes.
 *
 * É o lock que o schema de `ThinkzapBotSession` já pressupõe ("uma sessão ativa por chat
 * é garantida pelo lock por `bitrixChatId` no worker, não por constraint") e que não
 * existia. MySQL não tem unique parcial, então não há como delegar isso ao banco.
 *
 * O escopo é `(instalação, chat)` e não a fila inteira: serializar globalmente faria o
 * turno de um cliente esperar o de outro, e ordem só é observável dentro de uma conversa.
 *
 * `null` quando o lock está tomado — o chamador **descarta** o evento em vez de esperar.
 * Segurar um slot de concorrência bloqueado transformaria dez workers em um, e o evento
 * concorrente aqui é justamente o que não deve rodar duas vezes.
 */
export async function acquireBotChatLock(
  redis: IORedis,
  appId: string,
  chatId: string,
): Promise<BotChatLock | null> {
  const key = lockKey(appId, chatId)
  /**
   * Token por aquisição: impede um worker de liberar o lock de outro. Sem isso, um
   * worker lento cujo TTL expirou apagaria, ao terminar, o lock que o próximo dono
   * acabou de pegar.
   */
  const token = randomUUID()

  const acquired = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX')
  if (acquired !== 'OK') return null

  return {
    release: async () => {
      // Compare-and-delete atômico: `GET` seguido de `DEL` deixaria aberta a janela em
      // que o lock do próximo dono seria apagado por engano.
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
