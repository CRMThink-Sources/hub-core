import {
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
  deps: {
    getApp: GetInstalledAppRepository
    getAplicationContext: GetAplicationContext
  },
): Promise<LineItemsForApp | null> {
  const installedApp = await deps.getApp.getById(appId)
  if (!installedApp) return null

  const context = await deps.getAplicationContext.execute({
    domainId: installedApp.domainId,
    appCode: installedApp.appCodeId,
  })

  return {
    domainId: installedApp.domainId,
    appCode: installedApp.appCodeId,
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
