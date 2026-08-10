import type {
  AppInstallContext,
  AppInstaller,
} from '@/shared/domain/app-installer'
import { callBitrixIdempotent } from '@/shared/infra/clients/call-bitrix-idempotent'
import { ensureEventBindings } from '@/shared/infra/clients/ensure-event-bindings'
import { ensurePlacementBindings } from '@/shared/infra/clients/ensure-placement-bindings'
import { env } from '@/config/env'
import { buildAudioImTextareaPlacementBindParams } from '../application/build-audio-im-textarea-placement-params'
import { buildCrmDetailPlacementBindParams } from '../application/build-crm-detail-placement-bind-params'
import { ensureThinkzapRobot } from '../application/ensure-thinkzap-robot'
import { ensureSpaPlacements } from '../application/ensure-spa-conversation-widget-placements'
import { syncThinkzapRobotConnectorOptions } from '../application/sync-robot-connectors'
import { thinkzapError } from '../errors/catalog'

const WHATSAPP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.865 9.865 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`

const WHATSAPP_ICON_DATA = `data:image/svg+xml;charset=US-ASCII,${encodeURIComponent(WHATSAPP_ICON_SVG)}`

const CONNECTOR_MESSAGE_EVENTS = [
  'ONIMCONNECTORMESSAGEADD',
  'ONIMCONNECTORMESSAGEUPDATE',
  'ONIMCONNECTORMESSAGEDELETE',
] as const

export const THINKZAP_APP_CODE_ID = 'crmthink.thinkzap'

/**
 * Handlers de placement que são deste app. Só estes podem ser desligados na
 * reconciliação — um `CRM_DEAL_DETAIL_TAB` de outro app não é nosso para remover.
 */
const OWNED_PLACEMENT_HANDLERS = (): string[] =>
  [env.bitrix.placement.url, env.bitrix.iframeAudio.url].filter(Boolean)

export class ThinkzapInstaller implements AppInstaller {
  readonly appCode = THINKZAP_APP_CODE_ID

  async install(context: AppInstallContext): Promise<void> {
    const { client } = context

    await this.bindConnectorMessageEvents(context)
    await this.registerConnector(context)
    await this.bindCrmPlacements(context)
    await this.bindAudioPlacement(context)
    await this.addRobot(context)

    // Fail-fast: uma SPA que não vincula por motivo real derruba a instalação.
    await ensureSpaPlacements(client, { failFast: true })

    // Última coisa: o robô já existe neste ponto, e as opções de conector são
    // por instalação. `installedAppId` vem do contexto — o orquestrador não sabe
    // que este passo existe.
    await syncThinkzapRobotConnectorOptions(context.installedAppId)
  }

  private async bindConnectorMessageEvents({
    client,
  }: AppInstallContext): Promise<void> {
    const handler = env.bitrix.webhookUrl

    // Sem webhook o app instala mudo: nenhuma mensagem do Bitrix chega aqui.
    // Antes isso passava em silêncio; agora é erro de configuração explícito.
    if (!handler) {
      throw thinkzapError('thinkzap.config.missing_env')
    }

    await ensureEventBindings(
      client,
      CONNECTOR_MESSAGE_EVENTS.map(event => ({ event, handler })),
    )
  }

  private async registerConnector({
    client,
  }: AppInstallContext): Promise<void> {
    await callBitrixIdempotent(client, 'imconnector.register', {
      ID: env.bitrix.connector.code,
      NAME: env.bitrix.connector.name,
      ICON: {
        DATA_IMAGE: WHATSAPP_ICON_DATA,
        COLOR: '#25D366',
        SIZE: '90%',
        POSITION: 'center',
      },
      PLACEMENT_HANDLER: env.bitrix.connector.url,
      CHAT_GROUP: 'N',
      DEL_EXTERNAL_MESSAGES: 'N',
      EDIT_INTERNAL_MESSAGES: 'N',
      DEL_INTERNAL_MESSAGES: 'N',
      NEED_SIGNATURE: 'N',
    })
  }

  private async bindCrmPlacements({
    client,
  }: AppInstallContext): Promise<void> {
    await ensurePlacementBindings(
      client,
      buildCrmDetailPlacementBindParams(),
      OWNED_PLACEMENT_HANDLERS(),
    )
  }

  private async bindAudioPlacement({
    client,
  }: AppInstallContext): Promise<void> {
    const params = buildAudioImTextareaPlacementBindParams()

    // Placement opcional: sem handler configurado o app funciona, só não grava
    // áudio pela textarea do IM.
    if (!params.HANDLER) return

    await ensurePlacementBindings(
      client,
      [params as { PLACEMENT: string; HANDLER: string }],
      OWNED_PLACEMENT_HANDLERS(),
    )
  }

  /**
   * `ensureThinkzapRobot` faz add e, quando o robô já existe, `bizproc.robot.update`
   * — reinstalar passa a corrigir as propriedades do robô em vez de deixá-lo com
   * a definição da versão anterior.
   */
  private async addRobot({ client }: AppInstallContext): Promise<void> {
    await ensureThinkzapRobot(client)
  }
}
