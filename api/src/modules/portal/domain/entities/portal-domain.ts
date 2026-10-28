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

/**
 * Estado do vínculo da instalação com o espelho na SPA 1060.
 *
 * `mirror-missing` só sai de uma leitura que **respondeu** sem o item; leitura que
 * falhou é `unknown`. Confundir os dois mandaria o suporte "vincular" uma instalação
 * cujo espelho está lá, só porque o Bitrix caiu.
 */
export type PortalAppMirror =
  | 'linked'
  | 'no-mirror'
  | 'mirror-missing'
  | 'unknown'

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
  mirror: PortalAppMirror
  status: string
  email: string
  installedAt: string
  /**
   * Só no detalhe do cliente: a listagem não resolve contrato, porque seria uma
   * leitura de SPA por app de **todo** portal registrado.
   */
  contract?: PortalAppContract
}

/** Detalhe de uma instalação, para o cabeçalho da tela de aplicação do backoffice. */
export type PortalAppDetail = PortalDomainApp & {
  /** Idioma escolhido no app. `null` = nunca escolhido. */
  locale: string | null
  domain: { id: string; name: string; memberId: string }
}

/**
 * Indicadores do cliente, no topo do detalhe. Só existem no detalhe porque dependem do
 * contrato, que a listagem não resolve.
 */
export type PortalDomainSummary = {
  apps: number
  /** Assinaturas `active`, somando as aplicações. */
  activeSubscriptions: number
  /** Linhas das assinaturas que não estão canceladas — o que o cliente tem contratado. */
  lines: number
  mcpUsers: number
  /**
   * Algum contrato veio `unavailable`: os números de assinatura e linha são um piso,
   * não o total. A tela tem que dizer isso em vez de mostrar um número menor como certo.
   */
  incomplete: boolean
}

export type PortalDomainDetail = {
  id: string
  name: string
  memberId: string
  createdAt: string
  updatedAt: string
  /** Usuários MCP do domínio. Contagem do banco, custo de um `_count`. */
  mcpUserCount: number
  apps: PortalDomainApp[]
  /** Só no detalhe do cliente. */
  summary?: PortalDomainSummary
}
