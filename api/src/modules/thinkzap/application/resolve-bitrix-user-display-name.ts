import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'

/**
 * Por que o nome não veio. É o que separa "escopo do app não concedido" de
 * "cadastro incompleto" — duas ausências com consertos diferentes.
 */
export type OperatorNameFailure =
  /** Evento sem operador: nada foi consultado. */
  | 'no-user-id'
  /** O portal do cliente recusou `user.get` (escopo, credencial). */
  | 'bitrix-refused'
  /** `user.get` respondeu, mas sem usuário ou sem nome para o id. */
  | 'bitrix-empty'
  /** O registro de usuário permitido não tem `displayName`. */
  | 'allowed-user-empty'

export type OperatorNameResolution = {
  name: string | null
  /** Ausente quando o nome veio. */
  failure?: OperatorNameFailure
  /** Mensagem da recusa do Bitrix, quando `failure` é `bitrix-refused`. */
  refusal?: string
}

/**
 * Nome de exibição do operador, em duas origens.
 *
 * A primeira depende de escopo concedido na instalação do app, que o código não
 * controla; a segunda depende de cadastro, que pode estar incompleto. Origem que
 * falha **não** interrompe a cadeia — o que ela faz é ficar registrada no
 * resultado, para quem decidiu prefixar poder dizer o motivo em uma linha.
 */
export async function resolveBitrixUserDisplayName(params: {
  userId: string
  appId: string
  getBitrixUserDisplayName: GetBitrixUserDisplayNamePort
  getAllowedUser?: GetAllowedUserRepository
}): Promise<OperatorNameResolution> {
  const { userId, appId, getBitrixUserDisplayName, getAllowedUser } = params

  if (!userId.trim()) {
    return { name: null, failure: 'no-user-id' }
  }

  const fromBitrix = await getBitrixUserDisplayName.getDisplayName(userId)
  if (fromBitrix.name) {
    return { name: fromBitrix.name }
  }

  const bitrixFailure: OperatorNameFailure = fromBitrix.refusal
    ? 'bitrix-refused'
    : 'bitrix-empty'

  if (!getAllowedUser) {
    return {
      name: null,
      failure: bitrixFailure,
      refusal: fromBitrix.refusal,
    }
  }

  const allowedUser = await getAllowedUser.getByAppIdAndBitrixUserId(
    appId,
    userId,
  )
  const fromAllowedUser = allowedUser?.displayName?.trim()

  if (fromAllowedUser) {
    return { name: fromAllowedUser }
  }

  /**
   * Quando o Bitrix recusou, a recusa é o achado — o cadastro vazio é só a
   * consequência de ter sobrado um fallback. Preservar `bitrix-refused` aqui é o
   * que impede o log de apontar para o cadastro quando o problema é escopo.
   */
  return fromBitrix.refusal
    ? { name: null, failure: 'bitrix-refused', refusal: fromBitrix.refusal }
    : { name: null, failure: 'allowed-user-empty' }
}
