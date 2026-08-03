import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { findConnectorLineInContext } from './helpers/resolve-line-by-subscription-item'

export type LineSettingsReading = {
  /** Nome como o usuário digitou, já sem o prefixo do domínio. */
  name: string
  /** Fonte: `ufCrm93Settings` do item da SPA. */
  settings: ConnectorSettings
  /**
   * `null` = nenhum canal aberto do Bitrix vinculado.
   *
   * Fonte: `ufCrm93Conector` do item. `Instance` saiu daqui também — não há mais
   * estado em que a aba fique parcialmente indisponível por falta de registro.
   */
  vinculatedChannel: string | null
}

/**
 * O nome da linha é gravado na Z-API como `"{domínio} | {nome}"` — ver
 * `RenameLineOnProviderUseCase`. Aqui o prefixo é removido para devolver o que
 * o usuário digitou, do mesmo jeito que o handler de sessão já fazia.
 */
const stripDomainPrefix = (raw: string | undefined): string => {
  if (!raw) return ''
  const separator = ' | '
  const index = raw.indexOf(separator)
  return index === -1 ? raw : raw.slice(index + separator.length)
}

export class GetLineSettings {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {}

  async execute(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
  }): Promise<LineSettingsReading> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    /**
     * Aceita os dois providers: ajustes e vínculo de canal valem para linha Z-API e
     * oficial. Antes a resolução era Z-API-only e a aba não abria para HubMessage.
     */
    const item = findConnectorLineInContext(context, input.subscriptionItemId)

    /**
     * O nome remoto só existe na Z-API — a HubMessage não expõe leitura de canal,
     * então ali o nome editável é o do próprio item.
     *
     * Falha na leitura Z-API **não** degrada para nome vazio: o nome é campo
     * editável, e exibir vazio faria o usuário salvar e renomear a linha sem
     * querer. Erro sobe e o controller responde `502`.
     */
    const name =
      item.metadata.provider === 'ZAPI'
        ? stripDomainPrefix(
            (
              await this.zApiClient.getInstance(
                item.metadata.zApiInstanceId,
                item.metadata.zApiInstanceToken,
              )
            ).name,
          )
        : item.name

    return {
      name,
      settings: item.settings,
      vinculatedChannel: item.vinculatedChannel,
    }
  }
}
