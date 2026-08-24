import { formatOutboundMessageWithOperator } from './format-outbound-message-with-operator'
import {
  OperatorNameFailure,
  resolveBitrixUserDisplayName,
} from './resolve-bitrix-user-display-name'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

/** O que o chamador precisa para contar a história na aba de log do job. */
export type PrefixUnresolved = {
  operatorUserId: string
  failure: OperatorNameFailure
  /** Mensagem da recusa do Bitrix, quando houve recusa. */
  refusal?: string
}

/** Frase pronta por motivo — a mesma no log de aplicação e no log do job. */
const FAILURE_REASON: Record<OperatorNameFailure, string> = {
  'no-user-id': 'o evento não trouxe o id do operador',
  'bitrix-refused': 'o portal recusou `user.get` (escopo `user`/`user_brief`?)',
  'bitrix-empty': '`user.get` respondeu sem nome para o id do operador',
  'allowed-user-empty':
    'o usuário permitido desta instalação está sem nome cadastrado',
}

export function describePrefixUnresolved(info: PrefixUnresolved): string {
  return (
    `Prefixo de nome do operador está ligado, mas o nome não foi resolvido: ` +
    `${FAILURE_REASON[info.failure]} (operador=${info.operatorUserId || '—'})` +
    `${info.refusal ? ` | recusa: ${info.refusal}` : ''}. ` +
    'Mensagem enviada SEM prefixo — o prefixo é cosmético, a mensagem não.'
  )
}

/**
 * O texto que vai para o contato, com o prefixo de nome do operador quando a linha
 * pede.
 *
 * **Ponto único de decisão.** Todos os caminhos de saída de texto livre passam por
 * aqui — canal aberto do Bitrix, legenda de mídia, widget. Cada caminho decidindo
 * por conta própria é exatamente como o widget ficou sem prefixo enquanto o canal
 * aberto prefixava, com a mesma configuração de linha.
 *
 * **Prefixo impossível não derruba envio.** Toggle ligado e nome não resolvido
 * registra warning e segue com o texto cru: perder a mensagem por causa de um nome
 * seria trocar um defeito visível por um dano real. O que não pode continuar é o
 * silêncio — antes essa combinação não deixava rastro nenhum, e o cliente via só
 * "liguei o toggle e nada acontece".
 */
export async function prepareOpenLineOutboundText(params: {
  text: string
  settings: ConnectorSettings
  operatorUserId: string
  appId: string
  getBitrixUserDisplayName: GetBitrixUserDisplayNamePort
  getAllowedUser?: GetAllowedUserRepository
  /** Chamado só quando o prefixo estava ligado e não pôde ser aplicado. */
  onPrefixUnresolved?: (info: PrefixUnresolved) => void | Promise<void>
}): Promise<string> {
  if (!params.settings.prefixOperatorNameEnabled) {
    return params.text
  }

  const resolution = await resolveBitrixUserDisplayName({
    userId: params.operatorUserId,
    appId: params.appId,
    getBitrixUserDisplayName: params.getBitrixUserDisplayName,
    getAllowedUser: params.getAllowedUser,
  })

  if (!resolution.name) {
    const info: PrefixUnresolved = {
      operatorUserId: params.operatorUserId,
      failure: resolution.failure ?? 'bitrix-empty',
      refusal: resolution.refusal,
    }

    logThinkzapError(
      apiLogger,
      'thinkzap.message.operator_prefix_unresolved',
      {
        app: 'thinkzap',
        operatorUserId: info.operatorUserId,
        appId: params.appId,
        prefixFailure: info.failure,
        refusal: info.refusal,
      },
      { level: 'warn', msg: describePrefixUnresolved(info) },
    )

    await params.onPrefixUnresolved?.(info)
  }

  return formatOutboundMessageWithOperator(params.text, {
    enabled: true,
    operatorName: resolution.name,
  })
}
