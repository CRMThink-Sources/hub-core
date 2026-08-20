import { prisma } from '@/config/prisma'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import { thinkzapError } from '../errors/catalog'

/**
 * Faz `event.bind` / `event.unbind` no portal do cliente.
 *
 * **Não persiste mais nada.** Antes gravava as duas flags em `Instance.settings`;
 * agora quem persiste é `UpdateLineSettings`, numa escrita só no item da SPA, com
 * os quatro toggles juntos. Deixar a persistência aqui obrigaria duas escritas por
 * salvamento e reintroduziria `Instance` no caminho.
 *
 * O efeito colateral no Bitrix continua sendo a razão deste caso de uso existir
 * separado: os toggles de evento não são equivalentes aos outros dois.
 */
export type UpdateConnectorEventBindsInput = {
  /** `core_apps.id` da instalação. */
  appId: string
  messageUpdateEventEnabled?: boolean
  messageDeleteEventEnabled?: boolean
}

export class UpdateConnectorEventBindsUseCase {
  async execute(input: UpdateConnectorEventBindsInput): Promise<void> {
    const app = await prisma.app.findUnique({
      where: { id: input.appId },
      include: { credential: true, domain: true },
    })
    if (!app || !app.credential || !app.credential.accessToken) {
      throw new Error('App credentials not found')
    }

    const bitrixClient = new BitrixRestClient(
      app.domain.name,
      app.credential.accessToken,
    )

    const webhookUrl = env.bitrix.webhookUrl
    if (!webhookUrl) {
      throw thinkzapError('thinkzap.config.missing_env')
    }

    if (input.messageUpdateEventEnabled !== undefined) {
      const method = input.messageUpdateEventEnabled
        ? 'event.bind'
        : 'event.unbind'
      await bitrixClient.callMethod(method, {
        event: 'ONIMCONNECTORMESSAGEUPDATE',
        handler: webhookUrl,
        auth_type: '0',
      })
    }

    if (input.messageDeleteEventEnabled !== undefined) {
      const method = input.messageDeleteEventEnabled
        ? 'event.bind'
        : 'event.unbind'
      await bitrixClient.callMethod(method, {
        event: 'ONIMCONNECTORMESSAGEDELETE',
        handler: webhookUrl,
        auth_type: '0',
      })
    }
  }
}
