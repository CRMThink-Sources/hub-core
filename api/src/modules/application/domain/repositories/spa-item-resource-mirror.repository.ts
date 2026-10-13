/**
 * O recurso remoto de uma linha, espelhado fora do item da SPA 1146.
 *
 * `subscriptionId` entra porque o ajuste de cobrança precisa do contrato pai, e depois
 * do delete não há item de onde ler `parentId1142`.
 *
 * `unsubscribedAt` é a **marca de desassinado**: presente significa que o recurso já foi
 * desassinado no provider por um caminho nosso. É lida como booleano; o instante existe
 * para o log, não para lógica — comparar datas aqui exigiria confiar no relógio de dois
 * processos.
 *
 * `subscribedAt` é a **marca de assinado**, o par dela: presente significa que um caminho
 * nosso assinou o recurso no provider. É o que torna o subscribe idempotente frente aos
 * UPDATEs repetidos do item — o payload do evento não traz o valor anterior. As duas
 * marcas são **mutuamente exclusivas**: gravar uma apaga a outra (`setBillingState`).
 *
 * Não há `status` do item aqui, de propósito. O status é do item, muda por edição no CRM,
 * e guardá-lo criaria um segundo lugar para ele divergir — o job lê o item de qualquer
 * forma.
 */
export type SpaItemResourceMirror = {
  provider: 'ZAPI' | 'HUBMESSAGE'
  /** Id remoto principal: `instanceId` (Z-API) ou `channelId` (HubMessage). */
  instanceId: string
  zApiToken?: string
  channelId?: string
  /** Id do item pai na SPA 1142. */
  subscriptionId: string
  unsubscribedAt?: string
  subscribedAt?: string
}

/** O estado de cobrança do recurso no provider que um caminho nosso confirmou. */
export type SpaItemResourceBillingState = 'subscribed' | 'unsubscribed'

/**
 * O que se grava ao provisionar: tudo menos as marcas de cobrança, que só o ciclo de
 * cobrança escreve.
 */
export type SaveSpaItemResourceMirrorInput = Omit<
  SpaItemResourceMirror,
  'unsubscribedAt' | 'subscribedAt'
>

/**
 * Porta do espelho do recurso de um item da SPA 1146.
 *
 * Existe como contrato, e não como uso direto do Redis, pelo mesmo motivo de
 * `SpaParentReader`: os casos de uso precisam de quatro operações sobre um id, e o teste
 * não precisa de um Redis inteiro para exercitar os ramos de decisão.
 *
 * **Nenhum método lança por ausência.** `find` de item sem espelho devolve `null`, que é
 * estado esperado (item legado, ou espelho já apagado pela limpeza). Falha de
 * infraestrutura, essa sim, propaga — quem chama decide entre retentar e degradar, e as
 * duas decisões existem no código: o provisionamento degrada, os jobs retentam.
 */
export interface SpaItemResourceMirrorRepository {
  find(itemId: string): Promise<SpaItemResourceMirror | null>
  /**
   * Sobrescreve o valor, **sem TTL**. Preserva as marcas de cobrança quando o recurso é o
   * mesmo (mesmo provider e id remoto): regravar a credencial não muda o que o provider
   * cobra. Recurso diferente começa sem marca.
   */
  save(itemId: string, mirror: SaveSpaItemResourceMirrorInput): Promise<void>
  /**
   * Grava a marca do estado de cobrança e apaga a outra, preservando o resto do valor.
   *
   * Espelho ausente é no-op: sem credencial não há o que marcar, e criar o espelho aqui
   * gravaria um recurso que ninguém confirmou existir.
   */
  setBillingState(
    itemId: string,
    state: SpaItemResourceBillingState,
  ): Promise<void>
  remove(itemId: string): Promise<void>
}
