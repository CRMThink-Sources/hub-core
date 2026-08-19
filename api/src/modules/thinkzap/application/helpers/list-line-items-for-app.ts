import {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  LineEntitlement,
  resolveLineEntitlement,
} from '@/modules/thinkzap/domain/connector-trial'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'

export type LineItemsForApp = {
  /** Uuid de `core_domains` da instalação. */
  domainId: string
  /** `core_app_codes.id` da instalação. */
  appCode: string
  /** Itens que **são** linha: provider `ZAPI` ou `HUBMESSAGE`. */
  items: SubscriptionItem[]
  /**
   * As assinaturas como vieram, **com o pai de cada item preservado**.
   *
   * `items` acha a linha; isto é o que diz se ela funciona. O `flatMap` que monta
   * `items` descarta a assinatura no caminho, e sem ela não há como derivar
   * entitlement nem estado de trial — o portal admin precisa dos dois.
   */
  subscriptions: SubscriptionWithItems[]
}

/** Dependências para alcançar o contexto de billing a partir do uuid de `core_apps`. */
export type AppContextDeps = {
  getApp: GetInstalledAppRepository
  getAplicationContext: GetAplicationContext
}

/** O contexto da instalação, com as duas chaves que o resolveram. */
export type AppContext = {
  /** Uuid de `core_domains` da instalação. */
  domainId: string
  /** `core_app_codes.id` da instalação. */
  appCode: string
  context: AplicationContext
}

/**
 * O contexto de billing de uma instalação, a partir do **uuid de `core_apps`**.
 *
 * `GetAplicationContext` pede o par (`domainId`, `appCode`), que o JWT do tenant
 * entrega de graça. As superfícies internas — portal admin, jobs — só têm o `appId`,
 * e este é o salto que falta: uma leitura de `core_apps` para traduzir a chave.
 *
 * Devolve o contexto **inteiro**, não só os itens: quem opera sobre uma linha precisa
 * da assinatura pai (habilitação) e da instalação (`aplication.id`), e os helpers de
 * `resolve-line-by-subscription-item` recebem `AplicationContext`. Extraído de
 * `listLineItemsForApp`, que passou a ser um caso particular disto.
 *
 * `null` quando a instalação não existe — quem chama decide se isso é lista vazia
 * ou 404.
 */
export async function resolveAppContext(
  appId: string,
  deps: AppContextDeps,
): Promise<AppContext | null> {
  const installedApp = await deps.getApp.getById(appId)
  if (!installedApp) return null

  /**
   * Erro de leitura do contexto (Bitrix fora) **não** é capturado: tem que subir
   * para o controller virar `502`. Traduzir para `null` afirmaria que a instalação
   * não existe quando só a leitura falhou.
   */
  const context = await deps.getAplicationContext.execute({
    domainId: installedApp.domainId,
    appCode: installedApp.appCodeId,
  })

  return {
    domainId: installedApp.domainId,
    appCode: installedApp.appCodeId,
    context,
  }
}

/**
 * As linhas de uma instalação, a partir dos itens de assinatura.
 *
 * É a listagem canônica: `Connector` deixou de ser fonte de "quais linhas
 * existem". Linha criada direto na SPA não tem row naquela tabela, então
 * `listConnectors` devolvia lista vazia — sem erro e sem log, o que fazia a tela
 * do admin e o widget do CRM parecerem simplesmente não ter linha nenhuma.
 *
 * Item de cobrança sem conector (`NONE`) não entra: é assinatura sem linha, não
 * linha sem configuração.
 *
 * `null` quando a instalação não existe — quem chama decide se isso é lista vazia
 * ou erro.
 */
export async function listLineItemsForApp(
  appId: string,
  deps: AppContextDeps,
): Promise<LineItemsForApp | null> {
  const resolved = await resolveAppContext(appId, deps)
  if (!resolved) return null

  const { domainId, appCode, context } = resolved

  return {
    domainId,
    appCode,
    items: context.subscriptions
      .flatMap(subscription => subscription.items)
      .filter(item => item.metadata.provider !== 'NONE'),
    subscriptions: context.subscriptions,
  }
}

/**
 * Entitlement de cada item, indexado pelo id.
 *
 * Um mapa e não um campo no item: `SubscriptionItem` é a entidade da SPA, e
 * habilitação não é dado dela — é derivada da assinatura pai e do agora.
 */
export function entitlementsByItemId(
  subscriptions: SubscriptionWithItems[],
  now: Date,
): Record<string, LineEntitlement> {
  const map: Record<string, LineEntitlement> = {}

  for (const subscription of subscriptions) {
    const entitlement = resolveLineEntitlement(subscription, now)
    for (const item of subscription.items) {
      map[item.id] = entitlement
    }
  }

  return map
}

/**
 * O id da linha no provider, para as superfícies que ainda o exibem ou que
 * precisam dele para alcançar a row de `Instance`.
 *
 * Z-API usa o id da instância; HubMessage usa o id do canal, que é o que aquele
 * provider entrega e o que a âncora guarda em `instance_id`.
 */
export function providerLineId(item: SubscriptionItem): string | null {
  switch (item.metadata.provider) {
    case 'ZAPI':
      return item.metadata.zApiInstanceId
    case 'HUBMESSAGE':
      return item.metadata.hubmessageChannelId
    case 'NONE':
      return null
  }
}
