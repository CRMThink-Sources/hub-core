/**
 * Resumo de uma assinatura da SPA 1142, do jeito que a tela de suporte precisa:
 * o suficiente para responder "o que este cliente paga?" sem abrir a aplicação.
 */
export type PortalAppSubscriptionSummary = {
  id: string
  status: string
  modality: string
  planName: string
  currentPeriodEnd: string
  /** Quantas linhas esta assinatura provisiona — itens com conector real. */
  lineCount: number
}

/**
 * Estado do bloco de contrato de uma instalação, na SPA.
 *
 * Os três casos existem separados porque colapsá-los é o que faz a tela mentir:
 * `no-mirror` é instalação sem espelho (anterior ao vínculo, ou install que falhou),
 * `ok` com lista vazia é cliente que nunca contratou, e `unavailable` é o CRM interno
 * fora do ar — do qual **nada** se conclui sobre o cliente.
 */
export type PortalAppContract =
  | { status: 'ok'; subscriptions: PortalAppSubscriptionSummary[] }
  | { status: 'no-mirror' }
  | { status: 'unavailable' }

export type PortalDomainApp = {
  id: string
  appCodeId: string
  appCode: string
  appName: string
  /**
   * Título do item espelho na SPA 1060, com fallback para `appName` quando não há
   * espelho ou o Bitrix não devolve o item. É o mesmo nome que o tenant vê — admin e
   * cliente nomeando a instalação de formas diferentes é o que faz um chamado discutir
   * qual instalação é qual.
   */
  title: string
  /** Id do item espelho na SPA 1060. `null` = instalação sem espelho. */
  spaId: string | null
  status: string
  email: string
  installedAt: string
  /**
   * Só no detalhe do cliente: a listagem não resolve contrato, porque seria uma
   * leitura de SPA por app de **todo** portal registrado.
   */
  contract?: PortalAppContract
}

export type PortalDomainDetail = {
  id: string
  name: string
  memberId: string
  createdAt: string
  updatedAt: string
  apps: PortalDomainApp[]
}
