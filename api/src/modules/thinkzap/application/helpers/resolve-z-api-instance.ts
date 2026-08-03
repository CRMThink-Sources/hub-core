import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { findLineInContext } from './resolve-line-by-subscription-item'

export type ResolvedZApiInstance = {
  instanceId: string
  zApiToken: string
  instancePhone: string | null
}

export type ResolveZApiInstanceInput = {
  /** Id do item de assinatura — a linha, do ponto de vista do cliente. */
  subscriptionItemId: string
  domainId: string
  appCode: string
}

/**
 * Resolve a instância Z-API **conectada** de uma linha, para as operações que
 * exigem sessão ativa (grupos).
 *
 * A resolução é pelo item de assinatura, não por `connectorId`: ver
 * `resolveLineBySubscriptionItem`. Este wrapper acrescenta o que as operações de
 * grupo precisam além da credencial — a garantia de que a linha está conectada e o
 * telefone dela.
 *
 * **O estado de conexão vem da Z-API, não do banco.** `Instance.status` só é
 * escrito no provisionamento e em `markAsConnected` (caminho HubMessage, que exige
 * `wabaId`/`phoneId`); ler um QR code na Z-API nunca o atualiza. Gatear por ele
 * recusava grupos de linhas de fato conectadas — e exigir o registro persistido
 * recusava linhas sem `Instance`, cujo provisionamento é outra change. A aba
 * Conexão já lê `getInstance` ao vivo; grupos usam a mesma fonte, então as duas
 * telas não podem discordar.
 *
 * Consequência deliberada: `Instance` não participa mais desta resolução. Grupos
 * não precisam de `settings` nem de `vinculatedChannel` — só de credencial e sessão.
 */
export async function resolveZApiInstance(
  input: ResolveZApiInstanceInput,
  getAplicationContext: GetAplicationContext,
  zApiClient: ZApiClient,
): Promise<ResolvedZApiInstance> {
  /**
   * Erro de leitura do contexto não é capturado: tem que subir para o controller.
   * Traduzir para "não encontrado" afirmaria que a linha não existe quando só a
   * leitura falhou.
   */
  const context = await getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  const line = findLineInContext(context, input.subscriptionItemId)

  const instance = await zApiClient.getInstance(
    line.zApiInstanceId,
    line.zApiInstanceToken,
  )

  if (!instance.connected) {
    throw new Error('Instance is not connected')
  }

  /**
   * Cosmético para o chamador (rótulo do participante "eu" nos grupos): degrada
   * para `null` em vez de derrubar a operação.
   */
  let instancePhone: string | null = null
  try {
    const phoneData = await zApiClient.getPhoneData(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )
    instancePhone = phoneData?.phone ?? null
  } catch {
    instancePhone = null
  }

  return {
    instanceId: line.zApiInstanceId,
    zApiToken: line.zApiInstanceToken,
    instancePhone,
  }
}
