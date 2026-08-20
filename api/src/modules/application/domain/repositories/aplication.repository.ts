import { Aplication } from '@/modules/application/domain/entities/aplication'

/**
 * Porta de leitura do `title` no espelho da SPA 1060. O domínio declara, a
 * camada Bitrix implementa (`BitrixAplicationTitleReader`).
 *
 * É em lote porque uma listagem de aplicações precisaria de uma chamada por
 * item — e a listagem do Bitrix não pagina, então quem implementa também fatia
 * os ids em lotes.
 */
export interface AplicationTitleReader {
  /**
   * Ids **sem** título correspondente simplesmente não aparecem no `Map`: item
   * apagado no CRM e falha de rede são o mesmo caso para quem consome, que cai
   * para o nome do app. O reader nunca lança.
   */
  getTitlesBySpaIds(spaIds: string[]): Promise<Map<string, string>>
}

/**
 * Contrato de instalação de app, sobre `core_apps`.
 *
 * `linkSpaItem` e `unlinkSpaItem` são as **únicas escritas**, e as duas mexem só
 * na coluna do espelho. Não há `createAplication` nem `deactivateAplication` —
 * instalar e desinstalar app é do fluxo de instalação, que já escreve `core_apps`
 * e é a fonte de verdade do estado. O item da SPA é espelho de CRM, que pode ter
 * duplicata e pode ser apagado por engano: ele anula a coluna, nunca a linha.
 *
 * Os lookups devolvem `null`; `getAplication(id)` lança. Quem lê assinatura
 * trata o `null` de `getAplicationBySpaId` como inconsistência de dados, porque
 * ali o vínculo deveria existir.
 */
export interface AplicationRepository {
  getAplication(id: string): Promise<Aplication>
  /** `spaId` é o id do item na SPA 1060, não o uuid de `core_apps`. */
  getAplicationBySpaId(spaId: string): Promise<Aplication | null>
  /** `domain` é o host do portal (`core_domains.name`). */
  getAplicationByInstall(params: {
    domain: string
    appCode: string
  }): Promise<Aplication | null>
  /** Inclui as instalações inativas — filtrar é decisão de quem consome. */
  getAplicationsByCustomer(customerId: string): Promise<Aplication[]>
  linkSpaItem(id: string, spaId: string): Promise<Aplication>
  /**
   * Devolve `spa_id` a `NULL`. Chamado quando o item espelho é apagado no CRM:
   * `spa_id` pendurado é pior que nulo — nulo é estado tratado, que devolve
   * `subscriptions: []` por decisão, enquanto pendurado devolve o mesmo `[]` por
   * filtrar num pai morto, com um `warn` de título ausente e nada que ligue o
   * sintoma à exclusão.
   */
  unlinkSpaItem(id: string): Promise<Aplication>
}
