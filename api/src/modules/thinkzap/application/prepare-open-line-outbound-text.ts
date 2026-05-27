import { formatOutboundMessageWithOperator } from './format-outbound-message-with-operator'
import { resolveBitrixUserDisplayName } from './resolve-bitrix-user-display-name'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'

export async function prepareOpenLineOutboundText(params: {
  text: string
  settings: ConnectorSettings
  operatorUserId: string
  appId: string
  getBitrixUserDisplayName: GetBitrixUserDisplayNamePort
  getAllowedUser?: GetAllowedUserRepository
}): Promise<string> {
  const operatorName = params.settings.prefixOperatorNameEnabled
    ? await resolveBitrixUserDisplayName({
        userId: params.operatorUserId,
        appId: params.appId,
        getBitrixUserDisplayName: params.getBitrixUserDisplayName,
        getAllowedUser: params.getAllowedUser,
      })
    : null

  return formatOutboundMessageWithOperator(params.text, {
    enabled: params.settings.prefixOperatorNameEnabled,
    operatorName,
  })
}
