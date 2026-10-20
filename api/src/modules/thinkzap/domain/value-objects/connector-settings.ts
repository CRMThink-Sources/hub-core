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
  /**
   * Limite diário de envio, só para linha não oficial (Z-API). Desligado por padrão: linha
   * antiga não pode passar a recusar envio por um deploy.
   */
  dailyLimitEnabled: boolean
  /** Inteiro > 0 quando ligado. `null` = nunca configurado. */
  dailyLimit: number | null
  /**
   * Espelha no canal aberto o que o cliente envia do próprio aparelho (celular ou
   * WhatsApp Web), só na linha não oficial (Z-API). Desligado por padrão: ligar exige
   * ativar na instância a notificação de "enviadas por mim".
   */
  deviceMessageMirrorEnabled: boolean
}

export const DEFAULT_CONNECTOR_SETTINGS: ConnectorSettings = {
  prefixOperatorNameEnabled: false,
  widgetOpenChannelEnabled: false,
  dailyLimitEnabled: false,
  dailyLimit: null,
  deviceMessageMirrorEnabled: false,
}
