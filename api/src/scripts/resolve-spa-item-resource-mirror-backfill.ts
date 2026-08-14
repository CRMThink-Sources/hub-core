import { SaveSpaItemResourceMirrorInput } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { RawSubscriptionItem } from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { resolveRawItemResource } from '@/modules/thinkzap/application/helpers/raw-item-resource'

/**
 * A parte **pura** do backfill do espelho do recurso: item cru da SPA 1146 → valor a
 * gravar, ou o motivo de não gravar.
 *
 * Separada do runner porque é a parte que precisa de teste e a única onde há decisão. O
 * runner faz rede: lista a SPA e grava no Redis.
 */

export type MirrorBackfillOutcome =
  | { kind: 'mirror'; itemId: string; mirror: SaveSpaItemResourceMirrorInput }
  /** Não há recurso remoto a espelhar, ou não há pai onde ancorá-lo. */
  | {
      kind: 'skipped'
      itemId: string
      reason: 'sem-credencial' | 'sem-assinatura-pai'
    }

/**
 * O espelho de um item, ou o motivo de pular.
 *
 * **Nunca marca desassinado**, nem para item com status `cancelled`. Marcar por status
 * seria afirmar uma desassinatura que talvez nunca tenha acontecido — e a marca errada
 * nesse sentido é a caríssima: esconde para sempre um recurso que segue cobrado de nós.
 * Não marcar faz a próxima atualização daquele item desassinar de fato, e o preço é um
 * `unsubscribe` repetido nos itens que o gateway já desassinou, que é seguro por
 * construção.
 *
 * Por isso o `status` do item não entra na decisão em nenhum lugar aqui.
 */
export function resolveMirrorBackfill(
  item: Pick<
    RawSubscriptionItem,
    'id' | 'provider' | 'credentials' | 'subscriptionId'
  >,
): MirrorBackfillOutcome {
  const resource = resolveRawItemResource(item)

  if (!resource) {
    return { kind: 'skipped', itemId: item.id, reason: 'sem-credencial' }
  }

  /**
   * Sem pai não há espelho útil: o ajuste de cobrança da exclusão precisa do contrato, e
   * um espelho sem ele deixaria a limpeza desassinar o recurso e não corrigir a
   * quantidade cobrada — pior que não ter espelho, porque pareceria completo.
   */
  if (!item.subscriptionId) {
    return { kind: 'skipped', itemId: item.id, reason: 'sem-assinatura-pai' }
  }

  return {
    kind: 'mirror',
    itemId: item.id,
    mirror: {
      provider: resource.provider,
      instanceId: resource.instanceId,
      ...(resource.zApiToken !== undefined && {
        zApiToken: resource.zApiToken,
      }),
      ...(resource.channelId !== undefined && {
        channelId: resource.channelId,
      }),
      subscriptionId: item.subscriptionId,
    },
  }
}
