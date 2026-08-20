import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { findConnectorLineWithEntitlement } from './helpers/resolve-line-by-subscription-item'

export type LineSettingsReading = {
  /**
   * Nome da linha. Fonte: o `title` do item da SPA, para os dois providers.
   *
   * Sem prefixo de domínio: o `"{domínio} | "` existe só no valor que
   * `RenameLineOnProviderUseCase` espelha na Z-API, e nada mais lê de lá.
   */
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
  /**
   * Habilitação da linha. A leitura **não** recusa por bloqueio — devolve o estado,
   * e é a tela que trava os campos.
   *
   * Sem isto a aba abriria editável para uma linha que recusa gravar, e o usuário
   * só descobriria o bloqueio ao clicar em salvar.
   */
  entitlement: LineEntitlement
}

export class GetLineSettings {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

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
    const { item, entitlement } = findConnectorLineWithEntitlement(
      context,
      input.subscriptionItemId,
      new Date(),
    )

    /**
     * O nome vem do item nos dois providers, e nenhum provider é consultado por
     * ele.
     *
     * A leitura da Z-API que existia aqui custava uma chamada remota por abertura
     * da aba e fazia a aba **inteira** responder `502` quando o provider estava
     * fora — indisponibilidade de um sistema derrubando a edição de vínculo de
     * canal e de quatro toggles que não têm relação com ele. E lia de um lugar que
     * o resto do produto não exibe: lista, cabeçalho e seletor do widget sempre
     * mostraram `item.name`.
     */
    return {
      name: item.name,
      settings: item.settings,
      vinculatedChannel: item.vinculatedChannel,
      entitlement,
    }
  }
}
