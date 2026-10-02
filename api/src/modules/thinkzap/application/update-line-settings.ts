import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { RenameLineOnProviderUseCase } from './rename-line-on-provider.use-case'

export type UpdateLineSettingsInput = {
  item: SubscriptionItem
  // Host do portal: prefixo do nome na Z-API.
  domainName: string
  appId: string
  name?: string
  settings?: Partial<ConnectorSettings>
}

export class UpdateLineSettings {
  constructor(
    private readonly renameLineOnProvider: RenameLineOnProviderUseCase,
    private readonly items: SubscriptionItemRepository,
  ) {}

  async execute(input: UpdateLineSettingsInput): Promise<void> {
    // O item é a fonte do nome para todo provider; o provider só recebe espelho.
    if (input.name !== undefined) {
      await this.items.updateSubscriptionItem(input.item.id, {
        name: input.name,
      })

      // Espelho Z-API depois da fonte e tolerante a falha; HubMessage não expõe rename.
      if (input.item.metadata.provider === 'ZAPI') {
        const { zApiInstanceId, zApiInstanceToken } = input.item.metadata

        try {
          await this.renameLineOnProvider.execute({
            zApiInstanceId,
            zApiInstanceToken,
            domainName: input.domainName,
            name: input.name,
          })
        } catch (error) {
          logThinkzapError(
            apiLogger,
            'thinkzap.zapi.instance_update_failed',
            {
              app: 'thinkzap',
              subscriptionItemId: input.item.id,
              zApiInstanceId,
              name: input.name,
              err: error,
            },
            {
              msg: 'Nome da linha não foi espelhado na Z-API — o item já tem o nome novo',
            },
          )
        }
      }
    }

    const patch = input.settings
    if (patch === undefined || Object.keys(patch).length === 0) return

    await this.items.updateSubscriptionItem(input.item.id, {
      settings: mergeConnectorSettings(input.item.settings, patch),
    })
  }
}
