import { Instance } from '@/modules/thinkzap/domain/entities/instance'

/**
 * Infere o provider de uma linha a partir dos campos preenchidos na âncora local.
 *
 * `Instance` não tem coluna `provider`: `channelId` (e os demais campos
 * específicos do WhatsApp Oficial) só existem preenchidos em linha HubMessage —
 * em Z-API ficam nulos. Mesmo critério usado na criação da âncora
 * (`ensureLineInstance`), aqui só pro sentido inverso: dado o registro, qual
 * provider ele é.
 */
export function resolveInstanceProvider(
  instance: Pick<Instance, 'channelId'>,
): 'ZAPI' | 'HUBMESSAGE' {
  return instance.channelId ? 'HUBMESSAGE' : 'ZAPI'
}
