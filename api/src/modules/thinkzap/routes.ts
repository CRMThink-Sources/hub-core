import { Router } from 'express'
import { makeListConnectorsController } from './main/list-connectors-controller'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeListOpenChannelsController } from './main/make-list-open-channels-controller'
import { makeListPortalUsersController } from './main/make-list-portal-users-controller'
import { makeConnectChannelController } from './main/connector/make-connect-channel'
import { makeListTemplatesController } from './main/connector/make-list-templates'
import { makeCreateTemplateController } from './main/connector/make-create-template'
import { makeSyncTemplatesController } from './main/connector/make-sync-templates'
import { makeUpdateTemplateController } from './main/connector/make-update-template'
import { makeSetTemplateDefaultImageController } from './main/connector/make-set-template-default-image'
import { makeListDestinationsController } from './main/make-list-destinations-controller'
import { makeSendWidgetMessageController } from './main/make-send-widget-message-controller'
import { makeSendWidgetMessageMultipartController } from './main/make-send-widget-message-multipart-controller'
import { makeGetLineStatusForWidgetController } from './main/make-get-line-status-for-widget-controller'
import { makeGetOutboxStatusController } from './main/make-get-outbox-status-controller'
import { makeListWidgetTemplatesController } from './main/make-list-widget-templates-controller'
import { makeListTemplateLinesController } from './main/make-list-template-lines-controller'
import {
  makeListButtonOfficialLinesController,
  makeListButtonUnofficialLinesController,
} from './main/make-list-button-lines-controller'
import { makeSendWidgetTemplateController } from './main/make-send-widget-template-controller'
import { makeSendWidgetButtonController } from './main/make-send-widget-button-controller'
import { widgetMessageUploadParser } from './infra/http/widget-message-upload.multer'
import {
  templateHeaderImageUpload,
  widgetHeaderImageUpload,
} from './infra/http/template-header-image-upload.multer'
import { makeUploadWidgetTemplateHeaderImageController } from './main/make-upload-widget-template-header-image-controller'
import { makeAddGroupParticipantsController } from './main/make-add-group-participants-controller'
import { makeCreateGroupController } from './main/make-create-group-controller'
import { makeGetGroupMetadataController } from './main/make-get-group-metadata-controller'
import { makeLeaveGroupController } from './main/make-leave-group-controller'
import { makeListContactsController } from './main/make-list-contacts-controller'
import { makeListGroupsController } from './main/make-list-groups-controller'
import { makeRemoveGroupParticipantsController } from './main/make-remove-group-participants-controller'
import { makeUpdateGroupDescriptionController } from './main/make-update-group-description-controller'
import { makeUpdateGroupNameController } from './main/make-update-group-name-controller'
import { makeUpdateGroupPhotoController } from './main/make-update-group-photo-controller'
import { makeListAllowedUsersController } from './main/make-list-allowed-users-controller'
import { makeAddAllowedUserController } from './main/make-add-allowed-user-controller'
import { makeRemoveAllowedUserController } from './main/make-remove-allowed-user-controller'
import { makeUpdateAllowedUserPermissionsController } from './main/make-update-allowed-user-permissions-controller'
import {
  makeGetDisconnectNotifySettingsController,
  makeUpdateDisconnectNotifySettingsController,
} from './main/make-disconnect-notify-settings-controllers'
import { makeListAllowedDepartmentsController } from './main/make-list-allowed-departments-controller'
import { makeAddAllowedDepartmentController } from './main/make-add-allowed-department-controller'
import { makeRemoveAllowedDepartmentController } from './main/make-remove-allowed-department-controller'
import { makeUpdateAllowedDepartmentPermissionsController } from './main/make-update-allowed-department-permissions-controller'
import {
  thinkzapAccessMiddleware,
  requireThinkzapAdmin,
  requireThinkzapPermission,
} from './infra/middleware/thinkzap-access.middleware'
import { makeGetLogsControllerFactory } from '@/shared/main/make-get-logs-controller'
import { makeGetThinkzapAccessController } from './main/make-get-thinkzap-access-controller'
import { makeGetThinkzapHomeMessageStatsController } from './main/make-get-thinkzap-home-message-stats-controller'
import {
  makeActivateTrialController,
  makeGetTrialStateController,
} from './main/trial/make-trial-controllers'
import {
  makeCreateBillingPortalController,
  makeCreateCheckoutController,
  makeCreateLineController,
  makeGetSubscriptionStateController,
  makeListPlansController,
} from './main/subscription/make-subscription-controllers'
import {
  makeCreateBotFlowBindingController,
  makeCreateBotFlowController,
  makeDeleteBotFlowBindingController,
  makeDeleteBotFlowController,
  makeGetBotFlowController,
  makeGetThinkbotConnectorStatusController,
  makeListBotFlowBindingsController,
  makeListBotFlowsController,
  makePublishBotFlowController,
  makeSimulateBotFlowController,
  makeUpdateBotFlowBindingController,
  makeUpdateBotFlowController,
} from './main/bot-flow/make-bot-flow-controllers'
import {
  makeConnectLineChannelController,
  makeDeleteLineController,
  makeDisconnectLineController,
  makeGetLineConnectionController,
  makeGetLineQrCodeController,
  makeGetLineSettingsController,
  makeGetLineCadenceQueueController,
  makeLinkLineChannelController,
  makeUnlinkLineChannelController,
  makeGetLineSmsProviderController,
  makeRegisterLineSmsProviderController,
  makeDeleteLineSmsProviderController,
  makeGetLineTemplateProvidersController,
  makeRegisterTemplateSmsProviderController,
  makeDeleteTemplateSmsProviderController,
  makeUpdateLineSettingsController,
  makeReleaseDailyLimitExtraController,
  makeResetDailyLimitUsageController,
} from './main/line/make-line-controllers'
import { makeSaveInstallationLocaleController } from './main/make-installation-locale'

export const createThinkerszapRoutes = (): Router => {
  const router = Router()

  /**
   * Idioma escolhido no app, gravado para a instalação: é o que o servidor usa nos
   * avisos que gera sem tela aberta (limite diário). Qualquer usuário com acesso ao app
   * troca o idioma no menu, então qualquer um grava — vale a última escolha.
   */
  router.put(
    '/locale',
    adaptControllerFactory(makeSaveInstallationLocaleController),
  )

  // Widget CRM: any Bitrix user with valid JWT (authMiddleware on /api/thinkzap).
  router.get(
    '/destinations',
    adaptControllerFactory(makeListDestinationsController),
  )
  router.post(
    '/messages/send-widget',
    adaptControllerFactory(makeSendWidgetMessageController),
  )
  router.post(
    '/messages/send-widget-multipart',
    widgetMessageUploadParser.array('files', 10),
    adaptControllerFactory(makeSendWidgetMessageMultipartController),
  )
  // Caminho da linha do WhatsApp Oficial; `send-widget` é Z-API-only.
  router.post(
    '/messages/send-widget-template',
    adaptControllerFactory(makeSendWidgetTemplateController),
  )
  // Botões funcionam nos dois providers — ao contrário de `send-widget-template`,
  // não há restrição de linha aqui.
  router.post(
    '/messages/send-widget-button',
    adaptControllerFactory(makeSendWidgetButtonController),
  )
  /**
   * As três rotas abaixo ficam no bloco do widget, sem
   * `requireThinkzapPermission('connectors', 'read')`: o operador do contact center
   * manda mensagem sem administrar conectores. O escopo continua saindo do JWT (item
   * fora da árvore da instalação responde 404) e a resposta não traz credencial.
   */

  // Status da linha selecionada. `/lines/:itemId/connection` não serve: exige
  // `connectors:read`, agenda `DisconnectExpiredLine` e devolve a instância crua da Z-API.
  router.get(
    '/messages/line-status/:subscriptionItemId',
    adaptControllerFactory(makeGetLineStatusForWidgetController),
  )
  // Status das mensagens enviadas pelo widget: "aguardando janela de envio" da cadência.
  router.get(
    '/messages/outbox-status',
    adaptControllerFactory(makeGetOutboxStatusController),
  )
  // Templates aprovados da linha. `/lines/:itemId/templates` não serve: exige
  // `connectors:read`, devolve pendentes e reprovados e entrega os `components` crus.
  router.get(
    '/messages/widget-templates/:subscriptionItemId',
    adaptControllerFactory(makeListWidgetTemplatesController),
  )
  // Imagem do cabeçalho escolhida como arquivo no widget: hospeda e devolve a URL
  // que o envio manda em `headerImageUrl`.
  router.post(
    '/messages/widget-template-header-image',
    widgetHeaderImageUpload,
    adaptControllerFactory(makeUploadWidgetTemplateHeaderImageController),
  )
  // Linhas capazes de enviar template, para a tela do robô de Bizproc
  // (`USE_PLACEMENT`). `/connector/list` não serve: devolve a linha inteira.
  router.get(
    '/messages/template-lines',
    adaptControllerFactory(makeListTemplateLinesController),
  )
  // Linhas capazes de enviar botão, uma rota por provider — mesmo raciocínio
  // de `/messages/template-lines`, para as telas dos dois robôs de botão.
  router.get(
    '/messages/button-lines/official',
    adaptControllerFactory(makeListButtonOfficialLinesController),
  )
  router.get(
    '/messages/button-lines/unofficial',
    adaptControllerFactory(makeListButtonUnofficialLinesController),
  )

  // Antes do `thinkzapAccessMiddleware`: ele responde 403 sem acesso, e esta rota
  // precisa devolver 200 com o payload negado para o front renderizar o bloqueio.
  router.get(
    '/access/me',
    adaptControllerFactory(makeGetThinkzapAccessController),
  )

  router.use(thinkzapAccessMiddleware)

  // Logs (Loki) — qualquer usuário com acesso ao thinkzap do domínio.
  router.get(
    '/logs',
    adaptControllerFactory(makeGetLogsControllerFactory('thinkzap')),
  )

  /**
   * Contagem de mensagens enviadas/recebidas por provider, para a home do
   * ThinkZap. `connectors:read`, mesma permissão das demais leituras agregadas
   * do módulo (`/connector/list`, `/openchannels`) — não é dado de cobrança.
   */
  router.get(
    '/home/message-stats',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetThinkzapHomeMessageStatsController),
  )

  router.get(
    '/access/allowed-users',
    requireThinkzapAdmin,
    adaptControllerFactory(makeListAllowedUsersController),
  )
  router.post(
    '/access/allowed-users',
    requireThinkzapAdmin,
    adaptControllerFactory(makeAddAllowedUserController),
  )
  router.patch(
    '/access/allowed-users/:bitrixUserId',
    requireThinkzapAdmin,
    adaptControllerFactory(makeUpdateAllowedUserPermissionsController),
  )
  router.delete(
    '/access/allowed-users/:bitrixUserId',
    requireThinkzapAdmin,
    adaptControllerFactory(makeRemoveAllowedUserController),
  )

  // Lista de usuários avisados no chat interno do Bitrix quando uma linha Z-API
  // desconecta. App-wide, mesma permissão do resto da administração de acesso.
  router.get(
    '/disconnect-notify-settings',
    requireThinkzapAdmin,
    adaptControllerFactory(makeGetDisconnectNotifySettingsController),
  )
  router.patch(
    '/disconnect-notify-settings',
    requireThinkzapAdmin,
    adaptControllerFactory(makeUpdateDisconnectNotifySettingsController),
  )

  router.get(
    '/access/allowed-departments',
    requireThinkzapAdmin,
    adaptControllerFactory(makeListAllowedDepartmentsController),
  )
  router.post(
    '/access/allowed-departments',
    requireThinkzapAdmin,
    adaptControllerFactory(makeAddAllowedDepartmentController),
  )
  router.patch(
    '/access/allowed-departments/:bitrixDepartmentId',
    requireThinkzapAdmin,
    adaptControllerFactory(makeUpdateAllowedDepartmentPermissionsController),
  )
  router.delete(
    '/access/allowed-departments/:bitrixDepartmentId',
    requireThinkzapAdmin,
    adaptControllerFactory(makeRemoveAllowedDepartmentController),
  )

  // Trial gateado por `finance`; admin do Bitrix passa porque `canManageAccess`
  // curto-circuita o guard. `POST` não aceita período nem status: duração de trial é
  // regra de negócio, não parâmetro.
  router.get(
    '/trial',
    requireThinkzapPermission('finance', 'read'),
    adaptControllerFactory(makeGetTrialStateController),
  )
  router.post(
    '/trial',
    requireThinkzapPermission('finance', 'create'),
    adaptControllerFactory(makeActivateTrialController),
  )

  // Assinatura: o estado sai da SPA, nunca do gateway.
  router.get(
    '/subscription',
    requireThinkzapPermission('finance', 'read'),
    adaptControllerFactory(makeGetSubscriptionStateController),
  )
  router.get(
    '/plans',
    requireThinkzapPermission('finance', 'read'),
    adaptControllerFactory(makeListPlansController),
  )
  // Nenhuma das duas aceita preço, quantidade ou período — derivados no servidor.
  router.post(
    '/subscription/checkout',
    requireThinkzapPermission('finance', 'create'),
    adaptControllerFactory(makeCreateCheckoutController),
  )
  router.post(
    '/subscription/billing-portal',
    requireThinkzapPermission('finance', 'update'),
    adaptControllerFactory(makeCreateBillingPortalController),
  )

  // Criar linha adicional é `finance:create` e não `connectors:create`: é decisão de
  // cobrança antes de ser decisão de conector. Fica no bloco de assinatura por isso,
  // mesmo com o caminho `/lines`.
  router.post(
    '/lines',
    requireThinkzapPermission('finance', 'create'),
    adaptControllerFactory(makeCreateLineController),
  )

  /**
   * `itemId` é o id do item de assinatura — a linha, para o cliente. A credencial Z-API
   * é resolvida no servidor (`resolveLineBySubscriptionItem`) e o escopo sai do JWT:
   * item fora da árvore da instalação responde 404. `connectorId` não é aceito aqui:
   * aceitar os dois manteria vivo o caminho antigo, com o id livre no corpo.
   */
  router.get(
    '/lines/:itemId/connection',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineConnectionController),
  )
  router.get(
    '/lines/:itemId/qr-code',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineQrCodeController),
  )
  // Par do QR code na linha oficial (embedded signup da Meta no iframe). `update` e não
  // `create`: o canal já existe desde o provisionamento, aqui só liga o número a ele.
  router.post(
    '/lines/:itemId/connect-channel',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeConnectLineChannelController),
  )
  router.post(
    '/lines/:itemId/disconnect',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDisconnectLineController),
  )
  /**
   * Exclui a linha. `connectors:delete`, a mesma permissão de desconectar — as duas
   * são destrutivas, e quem pode derrubar a sessão pode excluir a linha.
   *
   * Não apaga o item da SPA — edita para `status: 'cancelled'` e grava quem/quando
   * excluiu (ver `DeleteLine`). A limpeza do recurso no provider e o ajuste da
   * cobrança são enfileirados diretamente por esta rota, com o mesmo resultado de
   * antes.
   */
  router.delete(
    '/lines/:itemId',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDeleteLineController),
  )
  router.get(
    '/lines/:itemId/settings',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineSettingsController),
  )
  /** Mensagens aguardando na fila da linha (cadenciador). Mesma permissão de ler os ajustes. */
  router.get(
    '/lines/:itemId/cadence/queue',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineCadenceQueueController),
  )
  router.patch(
    '/lines/:itemId/settings',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateLineSettingsController),
  )
  /** Libera extras do limite diário só para hoje. Mesma permissão de editar os ajustes. */
  router.post(
    '/lines/:itemId/daily-limit/extra',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeReleaseDailyLimitExtraController),
  )
  /** Zera o uso de hoje (contagem e extras). Mesma permissão de editar os ajustes. */
  router.post(
    '/lines/:itemId/daily-limit/reset',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeResetDailyLimitUsageController),
  )
  router.post(
    '/lines/:itemId/channel',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeLinkLineChannelController),
  )
  router.delete(
    '/lines/:itemId/channel',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeUnlinkLineChannelController),
  )
  /**
   * Provedor de mensagem da campanha de SMS, por linha.
   *
   * Mesmas permissões do vínculo de canal — as duas escrevem no portal do cliente, e
   * quem pode ligar a linha ao CRM pode oferecê-la à campanha. Remover é `delete`
   * porque tira a linha da tela de campanha e não tem desfazer automático.
   */
  router.get(
    '/lines/:itemId/sms-provider',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineSmsProviderController),
  )
  router.post(
    '/lines/:itemId/sms-provider',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeRegisterLineSmsProviderController),
  )
  router.delete(
    '/lines/:itemId/sms-provider',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDeleteLineSmsProviderController),
  )
  /**
   * Provedor por **template**, na linha oficial. O `CODE` do sender declara o
   * template, e é o que faz a lista de provedores da campanha virar o seletor de
   * template — o payload do handler não carrega essa informação por nenhum outro
   * caminho.
   *
   * Nome e idioma vão no corpo, inclusive no `DELETE`: o nome é do cliente e o
   * separador do `CODE` é `.`, então um segmento de path exigiria codificação em toda
   * chamada.
   */
  router.get(
    '/lines/:itemId/sms-templates',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineTemplateProvidersController),
  )
  router.post(
    '/lines/:itemId/sms-templates',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeRegisterTemplateSmsProviderController),
  )
  router.delete(
    '/lines/:itemId/sms-templates',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDeleteTemplateSmsProviderController),
  )

  router.get(
    '/connector/list',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListConnectorsController),
  )
  // Legado: conexão keyed por `connectorId`, serve as rows de `Connector` anteriores à
  // SPA, que resolvem o `channelId` pela `Instance`. O front não a alcança mais. Sai
  // junto com a tabela, em `retire-instance-table`.
  router.post(
    '/connector/connect-channel',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeConnectChannelController),
  )
  router.get(
    '/lines/:itemId/templates',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListTemplatesController),
  )
  router.post(
    '/lines/:itemId/templates',
    requireThinkzapPermission('connectors', 'update'),
    // JSON como antes, ou multipart com a imagem de exemplo em `headerImage`.
    templateHeaderImageUpload,
    adaptControllerFactory(makeCreateTemplateController),
  )
  router.post(
    '/lines/:itemId/templates/sync',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeSyncTemplatesController),
  )
  router.put(
    '/lines/:itemId/templates/:name/:language/default-image',
    requireThinkzapPermission('connectors', 'update'),
    // Link em JSON, ou multipart com o arquivo em `image`.
    widgetHeaderImageUpload,
    adaptControllerFactory(makeSetTemplateDefaultImageController),
  )
  router.put(
    '/lines/:itemId/templates/:templateId',
    requireThinkzapPermission('connectors', 'update'),
    // JSON, ou multipart com a imagem de exemplo em `headerImage`, como a criação.
    templateHeaderImageUpload,
    adaptControllerFactory(makeUpdateTemplateController),
  )
  router.get(
    '/openchannels',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListOpenChannelsController),
  )
  // Atendentes do portal para o editor de bot. Mesma permissão do `/openchannels`: é
  // leitura de cadastro do portal, não dado de cobrança.
  router.get(
    '/portal-users',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListPortalUsersController),
  )
  router.get(
    '/contacts',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListContactsController),
  )
  router.get(
    '/lines/:itemId/groups',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListGroupsController),
  )
  router.get(
    '/lines/:itemId/groups/:groupId',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetGroupMetadataController),
  )
  router.post(
    '/lines/:itemId/groups',
    requireThinkzapPermission('connectors', 'create'),
    adaptControllerFactory(makeCreateGroupController),
  )
  router.patch(
    '/lines/:itemId/groups/:groupId/name',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateGroupNameController),
  )
  router.patch(
    '/lines/:itemId/groups/:groupId/description',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateGroupDescriptionController),
  )
  router.patch(
    '/lines/:itemId/groups/:groupId/photo',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateGroupPhotoController),
  )
  router.post(
    '/lines/:itemId/groups/:groupId/participants',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeAddGroupParticipantsController),
  )
  router.delete(
    '/lines/:itemId/groups/:groupId/participants',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeRemoveGroupParticipantsController),
  )
  router.delete(
    '/lines/:itemId/groups/:groupId',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeLeaveGroupController),
  )

  /**
   * `simulate` é `read`: rodar no simulador não toca portal nem grava sessão.
   * Vínculo com canal exige `publish`, não CRUD: vincular põe o fluxo para atender
   * cliente de verdade, o mesmo efeito de publicar.
   */
  router.get(
    '/bot-flows',
    requireThinkzapPermission('thinkbot', 'read'),
    adaptControllerFactory(makeListBotFlowsController),
  )
  router.post(
    '/bot-flows',
    requireThinkzapPermission('thinkbot', 'create'),
    adaptControllerFactory(makeCreateBotFlowController),
  )
  router.post(
    '/bot-flows/simulate',
    requireThinkzapPermission('thinkbot', 'read'),
    adaptControllerFactory(makeSimulateBotFlowController),
  )
  // Antes de `/bot-flows/:flowId`, que capturaria o caminho como id.
  router.get(
    '/bot-flows/connector-status',
    requireThinkzapPermission('thinkbot', 'read'),
    adaptControllerFactory(makeGetThinkbotConnectorStatusController),
  )
  router.get(
    '/bot-flows/:flowId',
    requireThinkzapPermission('thinkbot', 'read'),
    adaptControllerFactory(makeGetBotFlowController),
  )
  router.patch(
    '/bot-flows/:flowId',
    requireThinkzapPermission('thinkbot', 'update'),
    adaptControllerFactory(makeUpdateBotFlowController),
  )
  router.post(
    '/bot-flows/:flowId/publish',
    requireThinkzapPermission('thinkbot', 'publish'),
    adaptControllerFactory(makePublishBotFlowController),
  )
  router.delete(
    '/bot-flows/:flowId',
    requireThinkzapPermission('thinkbot', 'delete'),
    adaptControllerFactory(makeDeleteBotFlowController),
  )

  router.get(
    '/bot-flow-bindings',
    requireThinkzapPermission('thinkbot', 'read'),
    adaptControllerFactory(makeListBotFlowBindingsController),
  )
  router.post(
    '/bot-flow-bindings',
    requireThinkzapPermission('thinkbot', 'publish'),
    adaptControllerFactory(makeCreateBotFlowBindingController),
  )
  router.patch(
    '/bot-flow-bindings/:bindingId',
    requireThinkzapPermission('thinkbot', 'publish'),
    adaptControllerFactory(makeUpdateBotFlowBindingController),
  )
  router.delete(
    '/bot-flow-bindings/:bindingId',
    requireThinkzapPermission('thinkbot', 'publish'),
    adaptControllerFactory(makeDeleteBotFlowBindingController),
  )

  return router
}
