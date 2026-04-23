import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

/**
 * Representa uma chamada BX24.callMethod a ser executada no frontend durante a instalação.
 * O frontend itera sobre os binds e executa cada um com BX24.callMethod(method, params).
 */
export interface BitrixInstallBind {
  method: string
  params: Record<string, unknown>
}

/**
 * Handler que fornece os binds do Bitrix para um app específico.
 * Similar ao padrão de webhook handlers - cada app registra seus binds.
 */
export interface BitrixInstallBindHandler {
  /** Códigos do app que este handler atende (ex: hubthink_thinkerszap, 1). Um deles deve corresponder ao app_code do install. */
  appCode: string
  getBinds(): BitrixInstallBind[]
  /**
   * Hook opcional executado após os binds estáticos.
   * Use para lógica de instalação que requer múltiplas chamadas sequenciais/condicionais.
   */
  onInstall?(client: BitrixRestClient): Promise<void>
}
