import { Plan, PlanProvider } from '@/modules/application/domain/entities/plan'
import {
  SubscriptionItem,
  SubscriptionItemMetadata,
} from '@/modules/application/domain/entities/subscription-item'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { resolvePlanForProvider } from '@/modules/thinkzap/domain/line-subscription'

/**
 * As decisões puras do backfill de cobrança legada, sem I/O.
 *
 * Recorte igual ao de `resolve-connector-settings-backfill`: elegibilidade,
 * derivação de provider, escolha de plano e pareamento com o que já existe na SPA
 * são regras testáveis sem tocar em banco, Bitrix ou Stripe. O script fica com a
 * orquestração e o relatório.
 */

/**
 * Linha de `billing_subscriptions` como sai do SQL cru. Os modelos foram removidos
 * do schema Prisma (`11896dd`), então não há tipo gerado — este é o contrato com a
 * consulta, e ele espelha as colunas do MySQL, não o vocabulário do domínio.
 */
export type LegacySubscriptionRow = {
  id: string
  appId: string
  /** Enum do MySQL: volta como string, nunca como valor do domínio. */
  status: string
  stripeSubscriptionId: string
  connectorQuantity: number
  trialEndsAt: Date | null
  createdAt: Date
}

/**
 * Instância de `core_thinkerszap_instances` já resolvida para a instalação dona,
 * pelo vínculo de `core_thinkerszap_connectors`.
 */
export type LegacyInstanceRow = {
  id: string
  instanceId: string
  zApiToken: string | null
  channelId: string | null
  wabaId: string | null
  vinculatedChannel: string | null
}

/**
 * Status legado → status da SPA, **mapa explícito**.
 *
 * Nunca `toLowerCase()`: a transformação de texto passaria `PAST_DUE` a `past_due`
 * sozinha se o filtro da consulta mudasse um dia, espelhando inadimplente como
 * assinatura válida sem ninguém revisar a decisão. Fora do mapa é `null`, e quem
 * chama conta como pulada.
 *
 * `TRIALING` **não** colapsa em `active`: trial é janela, e o produto bloqueia a
 * linha quando ela vence. Espelhar como ativo daria acesso permanente a quem só
 * testou.
 */
const STATUS_BY_LEGACY_STATUS: Record<string, Subscription['status']> = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
}

export function mapLegacyStatus(raw: string): Subscription['status'] | null {
  return STATUS_BY_LEGACY_STATUS[raw] ?? null
}

/**
 * Credencial da instância → `metadata` do item, ou `null` quando nenhuma das duas
 * está completa.
 *
 * `channel_id` é o discriminador, não `Connector.provider`: a coluna só é
 * preenchida no caminho HubMessage, e linha nascida na SPA pode não ter linha em
 * `connectors` com o provider certo. Mesma escolha de
 * `backfill-connector-settings-to-spa`.
 *
 * A WABA é **opcional** por design do domínio: ela só existe depois de o cliente
 * conectar o número na Meta, e exigi-la aqui deixaria de fora justamente as linhas
 * oficiais que ainda não passaram pelo embedded signup.
 *
 * Z-API exige o **par**: id da instância sem token não conecta nada, e o mapper da
 * SPA reprova o item incompleto na leitura seguinte.
 */
export function resolveInstanceMetadata(
  instance: LegacyInstanceRow,
): SubscriptionItemMetadata | null {
  if (instance.channelId) {
    return {
      provider: 'HUBMESSAGE',
      hubmessageChannelId: instance.channelId,
      ...(instance.wabaId ? { wabaId: instance.wabaId } : {}),
    }
  }

  if (instance.instanceId && instance.zApiToken) {
    return {
      provider: 'ZAPI',
      zApiInstanceId: instance.instanceId,
      zApiInstanceToken: instance.zApiToken,
    }
  }

  return null
}

/** Problema de catálogo que impede o backfill de escolher plano. */
export type PlanResolutionProblem =
  | { kind: 'missing'; provider: PlanProvider }
  | { kind: 'ambiguous'; provider: PlanProvider; candidateIds: string[] }

export type PlanResolution =
  | { ok: true; planIdByProvider: Record<PlanProvider, string | undefined> }
  | { ok: false; problems: PlanResolutionProblem[] }

/**
 * Escolhe o plano da SPA 1138 por provider, validando o catálogo inteiro **antes**
 * da primeira escrita.
 *
 * A decisão por provider é `resolvePlanForProvider`, do domínio — a mesma que o
 * checkout e a criação de linha adicional usam. Reusá-la, e não reescrever o
 * `filter`/`length`, é o que mantém uma regra só: se o produto passar a admitir dois
 * planos por conector, o backfill acompanha em vez de discordar em silêncio.
 *
 * O que é próprio daqui é o **conjunto** validado de uma vez: o backfill precisa
 * saber, antes de escrever qualquer coisa, que todos os providers em uso resolvem.
 * Falhar no meio deixaria metade das instalações espelhadas.
 *
 * Valida contra os providers **em uso** no conjunto a migrar, não contra os dois
 * possíveis: um catálogo sem plano HubMessage não pode bloquear um backfill 100%
 * Z-API. É a diferença entre um pré-requisito real e um pré-requisito imaginado.
 *
 * Candidato é plano **ativo com provider**. Não exige `gatewayId`, ao contrário do
 * predicado de ofertável: aqui não se abre checkout, só se aponta o plano que
 * descreve a cobrança que já existe no gateway.
 */
export function resolvePlanByProvider(
  plans: Plan[],
  providersInUse: Iterable<PlanProvider>,
): PlanResolution {
  const candidates = plans.filter(plan => plan.active && plan.provider)

  const planIdByProvider: Record<PlanProvider, string | undefined> = {
    ZAPI: undefined,
    HUBMESSAGE: undefined,
  }
  const problems: PlanResolutionProblem[] = []

  for (const provider of new Set(providersInUse)) {
    const resolution = resolvePlanForProvider(candidates, provider)

    switch (resolution.kind) {
      case 'missing':
        problems.push({ kind: 'missing', provider })
        break
      case 'ambiguous':
        problems.push({
          kind: 'ambiguous',
          provider,
          candidateIds: resolution.planIds,
        })
        break
      case 'resolved':
        planIdByProvider[provider] = resolution.plan.id
        break
    }
  }

  if (problems.length > 0) return { ok: false, problems }

  return { ok: true, planIdByProvider }
}

/**
 * A credencial que identifica a linha, para comparar instância do banco com item
 * já existente na SPA.
 *
 * Prefixada pelo provider: um `instanceId` da Z-API e um `channelId` da HubMessage
 * poderiam coincidir como texto, e a colisão pararia a criação de um item legítimo.
 */
export function credentialKey(
  metadata: SubscriptionItemMetadata,
): string | null {
  switch (metadata.provider) {
    case 'ZAPI':
      return `ZAPI:${metadata.zApiInstanceId}`
    case 'HUBMESSAGE':
      return `HUBMESSAGE:${metadata.hubmessageChannelId}`
    case 'NONE':
      return null
  }
}

export type InstanceMatch = {
  /** Instâncias sem item na SPA — as que o backfill precisa criar. */
  missing: Array<{
    instance: LegacyInstanceRow
    metadata: SubscriptionItemMetadata
  }>
  /** Instâncias que já têm item. Contadas, nunca atualizadas. */
  alreadyPresent: LegacyInstanceRow[]
  /** Instâncias sem credencial completa para nenhum provider. */
  withoutCredential: LegacyInstanceRow[]
}

/**
 * Pareia as instâncias do banco com os itens que a assinatura já tem.
 *
 * É a metade da idempotência que atua no nível do item: a outra metade é a busca da
 * assinatura por `gatewayId`. Sem esta, um run interrompido no meio da fase de itens
 * criaria os itens de novo no run seguinte, e a instalação passaria a ter duas linhas
 * cobradas para o mesmo número.
 *
 * Item existente nunca é atualizado — só reconhecido. O que está na SPA é
 * configuração do cliente e vale mais que o dado congelado no banco.
 */
export function matchExistingItems(
  instances: LegacyInstanceRow[],
  existingItems: SubscriptionItem[],
): InstanceMatch {
  const existingKeys = new Set(
    existingItems
      .map(item => credentialKey(item.metadata))
      .filter((key): key is string => key !== null),
  )

  const match: InstanceMatch = {
    missing: [],
    alreadyPresent: [],
    withoutCredential: [],
  }

  for (const instance of instances) {
    const metadata = resolveInstanceMetadata(instance)

    if (!metadata) {
      match.withoutCredential.push(instance)
      continue
    }

    const key = credentialKey(metadata)
    if (key && existingKeys.has(key)) {
      match.alreadyPresent.push(instance)
      continue
    }

    match.missing.push({ instance, metadata })
  }

  return match
}

/**
 * Divergência entre a quantidade contratada no legado e as instâncias que existem
 * de fato.
 *
 * **Relatório, nunca insumo:** o backfill cria item pelas instâncias reais, porque
 * item sem credencial é exatamente o item que a leitura da SPA reprova. Contrato de
 * 3 linhas com 2 instâncias vira 2 itens e este aviso — a terceira linha é decisão
 * comercial, não dado a inventar.
 */
export function reportQuantityDivergence(
  connectorQuantity: number,
  instanceCount: number,
): string | null {
  if (connectorQuantity === instanceCount) return null

  return `contrato legado com ${connectorQuantity} conector(es) e ${instanceCount} instância(s) no banco`
}

/** Nome do item, para a linha ser reconhecível na SPA sem abrir a credencial. */
export function lineName(metadata: SubscriptionItemMetadata): string {
  switch (metadata.provider) {
    case 'HUBMESSAGE':
      return 'WhatsApp Oficial'
    case 'ZAPI':
      return 'WhatsApp'
    case 'NONE':
      return 'Item de cobrança'
  }
}
