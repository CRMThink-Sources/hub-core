import { env } from '@/config/env'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { makeSubscriptionItemRepository } from '@/modules/application/main/make-subscription-item-repository'
import { listLineItemsForApp } from '@/modules/thinkzap/application/helpers/list-line-items-for-app'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type UpdateThinkzapConnectorEventBindsInput = {
  appId: string
  /** Id do item de assinatura — a mesma chave da listagem e da tela do tenant. */
  subscriptionItemId: string
  messageUpdateEventEnabled?: boolean
  messageDeleteEventEnabled?: boolean
}

export class ThinkzapLineNotFoundError extends Error {
  constructor(subscriptionItemId: string) {
    super(`Linha não encontrada para o item "${subscriptionItemId}"`)
    this.name = 'ThinkzapLineNotFoundError'
  }
}

/**
 * Liga e desliga os eventos de edição e exclusão de mensagem, do portal admin.
 *
 * Keyed pelo **item de assinatura**. Antes era `Connector.id`, que servia só para
 * chegar ao item pela credencial da instância — indireção que fazia a rota falhar
 * para toda linha nascida na SPA, que não tem row de conector.
 *
 * A persistência é no item (`ufCrm93Settings`). Era a última escrita em
 * `instance.settings`: enquanto existia, admin e tenant gravavam em lugares
 * diferentes, e o admin sobrescrevia o que o cliente tinha mudado na tela.
 */
export async function updateThinkzapConnectorEventBinds(
  input: UpdateThinkzapConnectorEventBindsInput,
): Promise<void> {
  const lines = await listLineItemsForApp(input.appId, {
    getApp: new PrismaInstalledAppRepository(),
    getAplicationContext: makeGetAplicationContext(),
  })

  if (!lines) throw new Error('Installed app not found')

  /**
   * Busca **na instalação**, não pelo id solto: um id de item de outra instalação
   * não pode ser configurado por este admin só porque ele acertou o id.
   */
  const item = lines.items.find(
    candidate => candidate.id === input.subscriptionItemId,
  )

  if (!item) throw new ThinkzapLineNotFoundError(input.subscriptionItemId)

  const { client } = await resolveBitrixClientForApp(input.appId)

  const webhookUrl = env.bitrix.webhookUrl
  if (!webhookUrl) {
    throw new Error('Webhook URL not configured')
  }

  if (input.messageUpdateEventEnabled !== undefined) {
    const method = input.messageUpdateEventEnabled
      ? 'event.bind'
      : 'event.unbind'
    await client.callMethod(method, {
      event: 'ONIMCONNECTORMESSAGEUPDATE',
      handler: webhookUrl,
      auth_type: '0',
    })
  }

  if (input.messageDeleteEventEnabled !== undefined) {
    const method = input.messageDeleteEventEnabled
      ? 'event.bind'
      : 'event.unbind'
    await client.callMethod(method, {
      event: 'ONIMCONNECTORMESSAGEDELETE',
      handler: webhookUrl,
      auth_type: '0',
    })
  }

  /**
   * Merge sobre o valor atual do item, e só depois do bind: bind que falha não
   * grava, para a tela não mostrar toggle ligado com evento não registrado.
   */
  const updatedSettings = mergeConnectorSettings(item.settings, {
    ...(input.messageUpdateEventEnabled !== undefined && {
      messageUpdateEventEnabled: input.messageUpdateEventEnabled,
    }),
    ...(input.messageDeleteEventEnabled !== undefined && {
      messageDeleteEventEnabled: input.messageDeleteEventEnabled,
    }),
  })

  await makeSubscriptionItemRepository().updateSubscriptionItem(item.id, {
    settings: updatedSettings,
  })
}
