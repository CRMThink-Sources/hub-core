import type { ContactIdentityRepository } from '@/modules/thinkzap/domain/repositories/contact-identity.repository'
import type { ResolvedContactIdentity } from './resolve-zapi-contact-identity'

export type ReplyRouteDeps = {
  identityRepo: Pick<ContactIdentityRepository, 'pinLegacyIdentity'>
  /** `findByProviderMessageId` do repositório de mensagens, já escopado pela instância. */
  findMessage: (
    instanceDbId: string,
    providerMessageId: string,
  ) => Promise<{ chatId: string | null; bitrixChatId: string | null } | null>
}

/**
 * Resposta que cita uma mensagem enviada pelo widget cai na conversa que o envio abriu.
 *
 * O envio pode ter aberto a conversa com identidade de telefone (a cadeia não achou o
 * LID do número digitado), enquanto a resposta chega com o LID no payload e viraria
 * outra sessão no Bitrix. A citação (`referenceMessageId`) é o único elo entre as duas
 * direções que não depende de converter LID em telefone.
 *
 * Só roteia quando a mensagem citada tem conversa realmente aberta (`bitrixChatId`) e o
 * `chat.id` dela é o telefone deste mesmo contato — sem essa checagem, citação de outro
 * contato postaria na conversa errada. Na dúvida devolve a identidade intacta.
 *
 * Ao rotear, fixa o `chat.id` como identidade do LID (`pinLegacyIdentity`, que nunca
 * sobrescreve), para que as mensagens seguintes sem citação não reabram o problema.
 * Identidade já fixada diferente da conversa citada é mantida: sobrescrever prenderia o
 * contato numa conversa só por uma citação.
 */
export async function resolveReplyChatRoute(
  input: {
    identity: ResolvedContactIdentity
    referenceMessageId?: string | null
    instanceDbId: string
  },
  deps: ReplyRouteDeps,
): Promise<ResolvedContactIdentity> {
  const { identity, referenceMessageId, instanceDbId } = input

  if (!referenceMessageId || !identity.lid) return identity

  const cited = await deps.findMessage(instanceDbId, referenceMessageId)
  if (!cited?.bitrixChatId || !cited.chatId) return identity
  if (cited.chatId === identity.identity) return identity

  // A conversa citada tem que ser deste contato: o chat.id do widget é o telefone dele.
  if (!identity.phone || cited.chatId !== identity.phone) return identity

  if (identity.legacy) return { ...identity, replyRoute: 'pin-kept' }

  const pinned = await deps.identityRepo.pinLegacyIdentity({
    instanceId: instanceDbId,
    lid: identity.lid,
    chatId: cited.chatId,
  })

  return {
    ...identity,
    identity: cited.chatId,
    legacy: true,
    replyRoute: 'routed',
    pinned,
  }
}
