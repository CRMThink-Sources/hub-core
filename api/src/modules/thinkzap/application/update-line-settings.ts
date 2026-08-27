import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { mergeConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'
import { apiLogger } from '@/shared/infra/logger'
import { RenameLineOnProviderUseCase } from './rename-line-on-provider.use-case'

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
  /**
   * `core_apps.id` da instalação.
   *
   * Continua no input mesmo sem os binds: a rota já o resolve do JWT, e tirá-lo
   * agora obrigaria a devolvê-lo no dia em que qualquer escrita voltar a precisar
   * de contexto de instalação.
   */
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
    /**
     * O nome da linha vive no **item**, para todo provider.
     *
     * É `SubscriptionItem.name` que a lista de conexões, o cabeçalho da tela de
     * configuração e o seletor de linhas do widget exibem. Enquanto o rename da
     * Z-API ia só ao provider, o `title` do item continuava sendo o gerado na
     * criação (`WhatsApp`, `WhatsApp 2`) — o cliente renomeava, recebia "salvo", e
     * nada mudava em lugar nenhum que ele olhasse.
     *
     * A gravação é incondicional; o que depende do provider é o espelho.
     */
    if (input.name !== undefined) {
      await this.items.updateSubscriptionItem(input.item.id, {
        name: input.name,
      })

      /**
       * Espelho na Z-API, **depois** da fonte e tolerante a falha.
       *
       * A instância é como o painel da Z-API e o suporte identificam o recurso, e
       * sem espelho toda instância do portal apareceria lá com o nome da criação.
       * Mas ela não é mais a fonte: derrubar o salvamento porque o provider não
       * recebeu o espelho deixaria o cliente sem renomear a própria linha por causa
       * de um sistema que ele não usa.
       *
       * A ordem importa nos dois sentidos — espelhar antes deixaria o painel com um
       * nome que o produto não tem, que é a divergência que esta gravação corrige.
       * Por isso a chamada fica depois, e falha na gravação do item propaga sem
       * chegar aqui.
       *
       * A HubMessage não entra: o provider não expõe renomear canal, e mandar este
       * rename ao gateway da Z-API chamaria a API errada com o id do canal.
       */
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
          apiLogger.warn(
            {
              app: 'thinkzap',
              subscriptionItemId: input.item.id,
              zApiInstanceId,
              name: input.name,
              err: error,
            },
            'Nome da linha não foi espelhado na Z-API — o item já tem o nome novo',
          )
        }
      }
    }

    const patch = input.settings
    if (patch === undefined || Object.keys(patch).length === 0) return

    /**
     * Uma escrita, e nenhum efeito no Bitrix.
     *
     * Havia aqui um passo de bind/unbind de evento antes da persistência, porque os
     * toggles de sincronização de edição e exclusão tocavam o portal do cliente. Com
     * as duas sincronizações descontinuadas, os toggles que restam são só nossos —
     * gravar settings não sai da SPA.
     */
    await this.items.updateSubscriptionItem(input.item.id, {
      settings: mergeConnectorSettings(input.item.settings, patch),
    })
  }
}
