import { Router } from 'express'
import { makeCreateSubscriptionCheckoutController } from './main/make-create-subscription-checkout-controller'
import { makeListConnectorsController } from './main/list-connectors-controller'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeListOpenChannelsController } from './main/make-list-open-channels-controller'
import { makeConnectChannelController } from './main/connector/make-connect-channel'
import { makeListTemplatesController } from './main/connector/make-list-templates'
import { makeCreateTemplateController } from './main/connector/make-create-template'
import { makeSyncTemplatesController } from './main/connector/make-sync-templates'
import { makeCancelConnectorController } from './main/connector/make-cancel-connector'
import { makeAddSubscriptionQuantityController } from './main/add-subscription-quantity-controller'
import { makePreviewAddQuantityController } from './main/make-preview-add-quantity-controller'
import { makeGetThinkzapPricingController } from './main/get-thinkzap-pricing-controller'
import { makeCreateBillingPortalSessionController } from './main/create-billing-portal-session-controller'
import { makeEndTrialSubscriptionController } from './main/end-trial-subscription-controller'
import { makeActivateTrialController } from './main/make-activate-trial-controller'
import { makeListDestinationsController } from './main/make-list-destinations-controller'
import { makeSendWidgetMessageController } from './main/make-send-widget-message-controller'
import { makeSendWidgetMessageMultipartController } from './main/make-send-widget-message-multipart-controller'
import { widgetMessageUploadParser } from './infra/http/widget-message-upload.multer'
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
import {
  makeDisconnectLineController,
  makeGetLineConnectionController,
  makeGetLineQrCodeController,
  makeGetLineSettingsController,
  makeLinkLineChannelController,
  makeUnlinkLineChannelController,
  makeUpdateLineSettingsController,
} from './main/line/make-line-controllers'

export const createThinkerszapRoutes = (): Router => {
  const router = Router()

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

  /**
   * Permissões do usuário do token. Fica **antes** do
   * `thinkzapAccessMiddleware` de propósito: o middleware responde `403` quando
   * o usuário não tem acesso, e esta rota precisa devolver `200` com o payload
   * negado para o front conseguir esconder links e renderizar o bloqueio.
   */
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

  router.get(
    '/pricing',
    requireThinkzapPermission('finance', 'read'),
    adaptControllerFactory(makeGetThinkzapPricingController),
  )
  router.post(
    '/subscription/billing-portal',
    requireThinkzapPermission('finance', 'update'),
    adaptControllerFactory(makeCreateBillingPortalSessionController),
  )
  router.post(
    '/subscription/end-trial',
    requireThinkzapPermission('finance', 'update'),
    adaptControllerFactory(makeEndTrialSubscriptionController),
  )
  router.post(
    '/subscription/activate-trial',
    requireThinkzapPermission('finance', 'create'),
    adaptControllerFactory(makeActivateTrialController),
  )
  router.post(
    '/subscription/checkout',
    requireThinkzapPermission('finance', 'create'),
    adaptControllerFactory(makeCreateSubscriptionCheckoutController),
  )
  router.get(
    '/subscription/add-quantity-preview',
    requireThinkzapPermission('finance', 'read'),
    adaptControllerFactory(makePreviewAddQuantityController),
  )
  router.post(
    '/subscription/add-quantity',
    requireThinkzapPermission('finance', 'update'),
    adaptControllerFactory(makeAddSubscriptionQuantityController),
  )

  /**
   * ## Linhas (`/lines/:itemId`)
   *
   * `itemId` é o id do **item de assinatura** — a linha, do ponto de vista do
   * cliente. A credencial Z-API é resolvida no servidor a partir dele
   * (`resolveLineBySubscriptionItem`), e o escopo sai do JWT: item que não está
   * na árvore da instalação responde `404`.
   *
   * `connectorId` não é aceito aqui. Aceitar os dois manteria vivo o caminho de
   * autorização antigo, em que o id vinha livre no corpo.
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
  router.post(
    '/lines/:itemId/disconnect',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDisconnectLineController),
  )
  router.get(
    '/lines/:itemId/settings',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetLineSettingsController),
  )
  router.patch(
    '/lines/:itemId/settings',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateLineSettingsController),
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

  router.get(
    '/connector/list',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListConnectorsController),
  )
  router.post(
    '/connector/cancel',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeCancelConnectorController),
  )
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
    adaptControllerFactory(makeCreateTemplateController),
  )
  router.post(
    '/lines/:itemId/templates/sync',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeSyncTemplatesController),
  )
  router.get(
    '/openchannels',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListOpenChannelsController),
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

  return router
}
