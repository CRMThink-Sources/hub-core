import type {
  SaveSpaItemResourceMirrorInput,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { apiLogger } from '@/shared/infra/logger'
import type { ProviderResourceRef } from '../provider-resource-billing'

/**
 * - `present`: o espelho já existia; nada foi gravado.
 * - `created`: o espelho não existia e foi gravado agora.
 * - `no-parent`: não existia e **não dá para criar** — o item não tem assinatura pai.
 */
export type EnsureLineMirrorOutcome = 'present' | 'created' | 'no-parent'

/**
 * Grava o espelho do recurso quando ele não existe, para que a marca de cobrança tenha
 * onde morar.
 *
 * `setBillingState` não cria espelho (o repositório não tem a credencial): sem ele, a
 * marca é descartada em silêncio, e a listagem do backoffice continua mostrando o
 * recurso como desconhecido mesmo depois de o provider ter aceitado a operação. Quem
 * assina ou desassina chama isto **depois** do sucesso no provider e **antes** da marca:
 * gravá-lo antes deixaria um espelho sem marca se a chamada falhasse, e ele é
 * indistinguível de recurso assinado.
 *
 * Sem `subscriptionId` não há espelho possível — o valor exige o contrato pai, que a
 * limpeza da exclusão vai precisar. Item sem pai é estado inválido na SPA; aqui ele
 * custa a idempotência (o próximo evento repetiria a operação), e o chamador decide como
 * avisar.
 */
export async function ensureLineMirror(
  mirrors: Pick<SpaItemResourceMirrorRepository, 'find' | 'save'>,
  args: {
    itemId: string
    resource: ProviderResourceRef
    subscriptionId: string | null
  },
): Promise<EnsureLineMirrorOutcome> {
  const { itemId, resource, subscriptionId } = args

  if (await mirrors.find(itemId)) return 'present'

  if (!subscriptionId) {
    apiLogger.warn(
      { app: 'thinkzap', itemId },
      'Item sem assinatura pai — espelho não gravado, e a desassinatura pode repetir no próximo evento',
    )
    return 'no-parent'
  }

  const mirror: SaveSpaItemResourceMirrorInput = {
    provider: resource.provider,
    instanceId: resource.instanceId,
    ...(resource.zApiToken !== undefined && { zApiToken: resource.zApiToken }),
    ...(resource.channelId !== undefined && { channelId: resource.channelId }),
    subscriptionId,
  }

  await mirrors.save(itemId, mirror)
  return 'created'
}
