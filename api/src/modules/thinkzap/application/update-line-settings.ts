import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { apiLogger } from '@/shared/infra/logger'
import { isValidDailyAmount } from '@/modules/thinkzap/domain/daily-send-limit'
import {
  isValidCadenceAmount,
  isValidCadenceConfig,
} from '@/modules/thinkzap/domain/send-cadence'
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
  /**
   * Se a instalação pode ativar o Cadenciador (flag do caminho unificado da
   * outbox). Ausente = indisponível.
   */
  cadenceAvailable?: boolean
}

const CADENCE_KEYS = [
  'cadenceEnabled',
  'cadenceMaxMessages',
  'cadenceWindowMinutes',
  'cadencePauseEnabled',
  'cadencePauseMinutes',
] as const

/**
 * A cadência só existe na linha não oficial (Z-API). Ligada, exige N e D inteiros
 * >= 1; com a pausa ligada, também P.
 *
 * Como o limite diário, valida o **resultado** do merge: ligar o toggle sem mandar
 * os valores vale se a linha já os tem gravados.
 *
 * Ativar depende da flag do caminho unificado — sem ela as origens síncronas não
 * passam pela fila e a cadência não teria como segurá-las. Desligar ou editar com
 * a cadência desligada continua permitido.
 */
function assertCadencePatch(
  item: SubscriptionItem,
  patch: Partial<ConnectorSettings> | undefined,
  cadenceAvailable: boolean,
): void {
  if (!patch) return
  if (!CADENCE_KEYS.some(key => key in patch)) return

  if (item.metadata.provider !== 'ZAPI') {
    throw thinkzapError('thinkzap.line.cadence_invalid')
  }

  for (const key of [
    'cadenceMaxMessages',
    'cadenceWindowMinutes',
    'cadencePauseMinutes',
  ] as const) {
    const value = patch[key]
    if (value !== undefined && value !== null && !isValidCadenceAmount(value)) {
      throw thinkzapError('thinkzap.line.cadence_invalid')
    }
  }

  const merged = { ...item.settings, ...patch }
  if (!isValidCadenceConfig(merged)) {
    throw thinkzapError('thinkzap.line.cadence_invalid')
  }

  if (merged.cadenceEnabled && !cadenceAvailable) {
    throw thinkzapError('thinkzap.line.cadence_unavailable')
  }
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

/**
 * Liga/desliga, na Z-API, a notificação das mensagens enviadas pelo próprio número.
 * Porta estreita para o teste não precisar do client inteiro.
 */
export type NotifySentByMeGateway = {
  updateNotifySentByMe(
    instanceId: string,
    token: string,
    enabled: boolean,
  ): Promise<void>
}

export class UpdateLineSettings {
  constructor(
    private readonly renameLineOnProvider: RenameLineOnProviderUseCase,
    private readonly items: SubscriptionItemRepository,
    private readonly notifySentByMe: NotifySentByMeGateway,
  ) {}

  async execute(input: UpdateLineSettingsInput): Promise<void> {
    // Antes de qualquer escrita: limite inválido não pode deixar o nome gravado pela metade.
    assertDailyLimitPatch(input.item, input.settings)
    assertCadencePatch(
      input.item,
      input.settings,
      input.cadenceAvailable === true,
    )

    /**
     * Também antes de qualquer escrita, e **estrito** — o oposto do rename. Toggle
     * gravado ligado sem a Z-API entregar os eventos é um recurso "ligado" que nunca
     * funciona; falhar aqui deixa tudo como estava, nome incluso.
     */
    await this.syncDeviceMessageMirror(input.item, input.settings)

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

  private async syncDeviceMessageMirror(
    item: SubscriptionItem,
    patch: Partial<ConnectorSettings> | undefined,
  ): Promise<void> {
    const wanted = patch?.deviceMessageMirrorEnabled
    if (wanted === undefined) return

    if (item.metadata.provider !== 'ZAPI') {
      throw thinkzapError('thinkzap.line.provider_unsupported')
    }

    // Sem mudança, sem chamada: salvar o mesmo valor não pode depender da Z-API.
    if (wanted === item.settings.deviceMessageMirrorEnabled) return

    const { zApiInstanceId, zApiInstanceToken } = item.metadata
    try {
      await this.notifySentByMe.updateNotifySentByMe(
        zApiInstanceId,
        zApiInstanceToken,
        wanted,
      )
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.zapi.notify_sent_by_me_failed',
        {
          app: 'thinkzap',
          subscriptionItemId: item.id,
          zApiInstanceId,
          enabled: wanted,
          err: error,
        },
        {
          msg: 'Espelhamento do aparelho não alterado na Z-API — nada foi gravado',
        },
      )
      throw error
    }
  }
}
