import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { apiLogger } from '@/shared/infra/logger'
import { isValidDailyAmount } from '@/modules/thinkzap/domain/daily-send-limit'
import {
  logThinkzapError,
  thinkzapError,
} from '@/modules/thinkzap/errors/catalog'
import { RenameLineOnProviderUseCase } from './rename-line-on-provider.use-case'

export type UpdateLineSettingsInput = {
  item: SubscriptionItem
  // Host do portal: prefixo do nome na Z-API.
  domainName: string
  appId: string
  name?: string
  settings?: Partial<ConnectorSettings>
}

/**
 * O limite diário só existe na linha não oficial (Z-API) e, ligado, exige inteiro > 0.
 *
 * Valida o **resultado** do merge, não só o patch: ligar o toggle sem mandar o valor
 * é válido se a linha já tem um limite gravado, e inválido se não tem.
 */
function assertDailyLimitPatch(
  item: SubscriptionItem,
  patch: Partial<ConnectorSettings> | undefined,
): void {
  if (!patch) return
  const touchesLimit = 'dailyLimitEnabled' in patch || 'dailyLimit' in patch
  if (!touchesLimit) return

  if (item.metadata.provider !== 'ZAPI') {
    throw thinkzapError('thinkzap.line.daily_limit_invalid')
  }

  if (
    patch.dailyLimit !== undefined &&
    patch.dailyLimit !== null &&
    !isValidDailyAmount(patch.dailyLimit)
  ) {
    throw thinkzapError('thinkzap.line.daily_limit_invalid')
  }

  const merged = { ...item.settings, ...patch }
  if (merged.dailyLimitEnabled && !isValidDailyAmount(merged.dailyLimit)) {
    throw thinkzapError('thinkzap.line.daily_limit_invalid')
  }
}

export class UpdateLineSettings {
  constructor(
    private readonly renameLineOnProvider: RenameLineOnProviderUseCase,
    private readonly items: SubscriptionItemRepository,
  ) {}

  async execute(input: UpdateLineSettingsInput): Promise<void> {
    // Antes de qualquer escrita: limite inválido não pode deixar o nome gravado pela metade.
    assertDailyLimitPatch(input.item, input.settings)

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
