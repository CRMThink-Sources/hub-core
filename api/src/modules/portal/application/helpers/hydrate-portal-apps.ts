import { AplicationTitleReader } from '@/modules/application/domain/repositories/aplication.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { apiLogger } from '@/shared/infra/logger'
import type {
  PortalAppContract,
  PortalDomainApp,
  PortalDomainDetail,
} from '../../domain/entities/portal-domain'

export type PortalHydrationDeps = {
  titles: AplicationTitleReader
  subscriptions: SubscriptionRepository
  items: SubscriptionItemRepository
}

/**
 * Sobrescreve `title` com o do item espelho da SPA 1060, em lote, para N domínios.
 *
 * Uma chamada de CRM fatiada em lotes (`getTitlesBySpaIds`) para o portal inteiro, e
 * não uma por app: a listagem de clientes não pode custar uma ida ao Bitrix por linha
 * da tabela.
 *
 * Nunca lança: `BitrixAplicationTitleReader` já degrada por conta própria — id sem
 * título no `Map` cai para `appName`. Título é enfeite de leitura, e `core_apps`, que é
 * a fonte de verdade da instalação, já respondeu.
 */
export async function hydrateAppTitles(
  domains: PortalDomainDetail[],
  titles: AplicationTitleReader,
): Promise<PortalDomainDetail[]> {
  const spaIds = domains
    .flatMap(domain => domain.apps)
    .map(app => app.spaId)
    .filter((spaId): spaId is string => spaId !== null)

  if (spaIds.length === 0) return domains

  const titlesBySpaId = await titles.getTitlesBySpaIds(spaIds).catch(error => {
    apiLogger.warn(
      { err: error },
      'Falha ao ler títulos da SPA 1060 para o portal admin',
    )
    return new Map<string, string>()
  })

  return domains.map(domain => ({
    ...domain,
    apps: domain.apps.map(app => ({
      ...app,
      title: (app.spaId && titlesBySpaId.get(app.spaId)) || app.appName,
    })),
  }))
}

/**
 * Acrescenta o bloco de contrato a cada app do detalhe do cliente.
 *
 * Só no detalhe: N é o número de apps de **um** cliente. Na listagem isso seria uma
 * leitura de SPA por app de todo portal registrado, e a tela que o suporte abre
 * primeiro é a que menos precisa do dado.
 *
 * A falha é capturada **por app**: um app com o CRM fora não pode apagar os outros da
 * tela, e `unavailable` não é `[]` — o suporte tem que poder distinguir "não contratou"
 * de "não sabemos".
 */
export async function hydrateAppContracts(
  domain: PortalDomainDetail,
  deps: PortalHydrationDeps,
): Promise<PortalDomainDetail> {
  const apps = await Promise.all(
    domain.apps.map(app => resolveContract(app, deps)),
  )

  return { ...domain, apps }
}

async function resolveContract(
  app: PortalDomainApp,
  deps: PortalHydrationDeps,
): Promise<PortalDomainApp> {
  // Sem espelho não há o que consultar: o filtro da SPA 1142 é pelo campo parent.
  if (!app.spaId) return { ...app, contract: { status: 'no-mirror' } }

  try {
    return { ...app, contract: await readContract(app.spaId, deps) }
  } catch (error) {
    apiLogger.warn(
      { err: error, appId: app.id, spaId: app.spaId },
      'Falha ao ler assinaturas da SPA 1142 para o portal admin',
    )
    return { ...app, contract: { status: 'unavailable' } }
  }
}

async function readContract(
  spaId: string,
  deps: PortalHydrationDeps,
): Promise<PortalAppContract> {
  const subscriptions =
    await deps.subscriptions.getSubscriptionsByAplication(spaId)

  /**
   * Uma listagem de itens por assinatura, só para contar linhas. É a mesma travessia
   * que `GetAplicationContext` faz, com o mesmo cache — o resumo não vale uma segunda
   * fonte de verdade sobre quantas linhas a assinatura provisiona.
   */
  const itemsBySubscription = await Promise.all(
    subscriptions.map(subscription =>
      deps.items.getSubscriptionItemsBySubscription(subscription.id),
    ),
  )

  return {
    status: 'ok',
    subscriptions: subscriptions.map((subscription, index) => ({
      id: subscription.id,
      status: subscription.status,
      modality: subscription.modality,
      planName: subscription.plan.name,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      /** Item `NONE` é cobrança sem linha, então não conta como linha. */
      lineCount: (itemsBySubscription[index] ?? []).filter(
        item => item.metadata.provider !== 'NONE',
      ).length,
    })),
  }
}
