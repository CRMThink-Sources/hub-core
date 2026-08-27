/**
 * Os toggles persistidos da linha.
 *
 * Eram quatro. `messageUpdateEventEnabled` e `messageDeleteEventEnabled` saíram com a
 * descontinuação das sincronizações de edição e exclusão de mensagem — os recursos
 * não existem mais, e toggles sobre eles salvariam sem nada acontecer.
 *
 * **Os campos continuam gravados nos itens antigos da SPA**, e são ignorados na
 * leitura: `parseConnectorSettings` descarta chave desconhecida sem cair nos defaults.
 * Isso importa mais do que parece — praticamente toda a base tem as duas chaves, e
 * tratá-las como shape inválido religaria `prefixOperatorNameEnabled` em todo cliente
 * que o desligou.
 */
export type ConnectorSettings = {
  prefixOperatorNameEnabled: boolean
  widgetOpenChannelEnabled: boolean
}

export const DEFAULT_CONNECTOR_SETTINGS: ConnectorSettings = {
  prefixOperatorNameEnabled: false,
  widgetOpenChannelEnabled: false,
}
