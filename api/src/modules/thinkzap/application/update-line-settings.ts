import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { RenameLineOnProviderUseCase } from './rename-line-on-provider.use-case'
import { UpdateConnectorEventBindsUseCase } from './update-connector-event-binds.use-case'

/**
 * Grava os ajustes de uma linha.
 *
 * Os quatro toggles não são equivalentes: `prefixOperatorNameEnabled` e
 * `widgetOpenChannelEnabled` só persistem, enquanto `messageUpdateEventEnabled` e
 * `messageDeleteEventEnabled` também fazem `event.bind` / `event.unbind` no portal
 * do cliente. É por isso que a orquestração existe em vez de um `updateSettings`
 * só.
 *
 * **Uma escrita, um destino.** Os quatro toggles vão juntos para
 * `ufCrm93Settings` do item da SPA, depois de merge sobre o valor atual. Antes eram
 * duas escritas em `Instance` — uma por caso de uso — e nenhuma delas via o
 * estado completo.
 *
 * `Instance` não participa: nem para ler o valor atual (vem do item), nem para
 * gravar, nem para renomear (a credencial e o host vêm do contexto).
 */
export type UpdateLineSettingsInput = {
  /** Item já resolvido, com `settings` atual e credencial em `metadata`. */
  item: SubscriptionItem
  /** Host do portal do cliente, para o prefixo do nome na Z-API. */
  domainName: string
  /** `core_apps.id` da instalação, para o cliente Bitrix dos binds. */
  appId: string
  name?: string
  settings?: Partial<ConnectorSettings>
}

export class UpdateLineSettings {
  constructor(
    private readonly renameLineOnProvider: RenameLineOnProviderUseCase,
    private readonly updateEventBinds: UpdateConnectorEventBindsUseCase,
    private readonly items: SubscriptionItemRepository,
  ) {}

  async execute(input: UpdateLineSettingsInput): Promise<void> {
    /**
     * Renomear depende do provider.
     *
     * Z-API tem nome próprio na instância, e é ele que a aba Conexão exibe — então
     * o rename vai ao provider. A HubMessage não expõe renomear canal, então o nome
     * editável é o `title` do item, e a gravação é local à SPA.
     *
     * Mandar o rename de HubMessage ao gateway Z-API chamaria a API errada com o id
     * do canal — falha remota por um nome que nem vive lá.
     */
    if (input.name !== undefined) {
      if (input.item.metadata.provider === 'ZAPI') {
        await this.renameLineOnProvider.execute({
          zApiInstanceId: input.item.metadata.zApiInstanceId,
          zApiInstanceToken: input.item.metadata.zApiInstanceToken,
          domainName: input.domainName,
          name: input.name,
        })
      } else {
        await this.items.updateSubscriptionItem(input.item.id, {
          name: input.name,
        })
      }
    }

    const patch = input.settings
    if (patch === undefined || Object.keys(patch).length === 0) return

    /**
     * Binds **antes** da persistência: tocam o Bitrix do cliente e podem falhar
     * por credencial. Falhando, nada é gravado — o usuário vê o erro do bind em
     * vez de um sucesso mentiroso com o Bitrix fora de sincronia.
     *
     * Isso mudou junto com a escrita única: antes os toggles simples já estavam
     * gravados quando o bind falhava, e o estado ficava meio salvo.
     */
    if (
      patch.messageUpdateEventEnabled !== undefined ||
      patch.messageDeleteEventEnabled !== undefined
    ) {
      await this.updateEventBinds.execute({
        appId: input.appId,
        messageUpdateEventEnabled: patch.messageUpdateEventEnabled,
        messageDeleteEventEnabled: patch.messageDeleteEventEnabled,
      })
    }

    await this.items.updateSubscriptionItem(input.item.id, {
      settings: mergeConnectorSettings(input.item.settings, patch),
    })
  }
}
