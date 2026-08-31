import type {
  AppInstallContext,
  AppInstaller,
} from '@/shared/domain/app-installer'
import { callBitrixIdempotent } from '@/shared/infra/clients/call-bitrix-idempotent'
import { ensureEventBindings } from '@/shared/infra/clients/ensure-event-bindings'
import { ensurePlacementBindings } from '@/shared/infra/clients/ensure-placement-bindings'
import { env } from '@/config/env'
import { buildConnectorRegisterParams } from './build-connector-register-params'
import { buildAudioImTextareaPlacementBindParams } from '../application/build-audio-im-textarea-placement-params'
import { buildCrmDetailPlacementBindParams } from '../application/build-crm-detail-placement-bind-params'
import { ensureThinkzapRobot } from '../application/ensure-thinkzap-robot'
import { ensureTemplateRobot } from '../application/ensure-template-robot'
import { ensureSpaPlacements } from '../application/ensure-spa-conversation-widget-placements'
import { syncThinkzapRobotConnectorOptions } from '../application/sync-robot-connectors'
import { thinkzapError } from '../errors/catalog'

/**
 * Só o de mensagem recebida.
 *
 * `ONIMCONNECTORMESSAGEUPDATE` e `ONIMCONNECTORMESSAGEDELETE` **não** entram: as
 * sincronizações de edição e exclusão foram descontinuadas, e registrar os binds
 * entregaria os eventos a handlers que só os descartam.
 */
const CONNECTOR_MESSAGE_EVENTS = ['ONIMCONNECTORMESSAGEADD'] as const

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
    await this.addTemplateRobot(context)

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

  /**
   * O corpo vem de `buildConnectorRegisterParams` e não é montado aqui: o script de
   * re-registro das instalações antigas manda exatamente o mesmo, e duas montagens
   * divergiriam no primeiro campo novo.
   */
  private async registerConnector({
    client,
  }: AppInstallContext): Promise<void> {
    await callBitrixIdempotent(
      client,
      'imconnector.register',
      buildConnectorRegisterParams(),
    )
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

  /**
   * Robô de envio de template, ao lado do de envio livre. Sem
   * `BITRIX_TEMPLATE_ROBOT_HANDLER_URL` o passo é no-op — instalar num ambiente que
   * ainda não publicou a rota do webhook continua funcionando, só sem o robô novo.
   */
  private async addTemplateRobot({ client }: AppInstallContext): Promise<void> {
    await ensureTemplateRobot(client)
  }
}
