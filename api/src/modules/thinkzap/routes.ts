import { Router } from 'express'
import { makeCreateSubscriptionCheckoutController } from './main/make-create-subscription-checkout-controller'
import { makeListConnectorsController } from './main/list-connectors-controller'
import { makeGetQrCodeController } from './main/get-qr-code-controller'
import { makeVinculateChannelController } from './main/connector/make-vinculate-channel'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeListOpenChannelsController } from './main/make-list-open-channels-controller'
import { makeDisconnectChannelController } from './main/connector/make-disconnect-channel'
import { makeUpdateInstanceController } from './main/instance/make-update-instance-controller'
import { makeDisconnectConnectorController } from './main/connector/make-disconnect-connector'
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

export const createThinkerszapRoutes = (): Router => {
  const router = Router()

  router.use(thinkzapAccessMiddleware)

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

  router.get(
    '/connector/list',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListConnectorsController),
  )
  router.get(
    '/connector/:id/qr-code',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetQrCodeController),
  )
  router.post(
    '/connector/disconnect',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDisconnectConnectorController),
  )
  router.post(
    '/connector/cancel',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeCancelConnectorController),
  )
  router.post(
    '/connector/vinculate-channel',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeVinculateChannelController),
  )
  router.post(
    '/connector/disconnect-channel',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeDisconnectChannelController),
  )
  router.put(
    '/instance/:id',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateInstanceController),
  )
  router.get(
    '/openchannels',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListOpenChannelsController),
  )
  router.get(
    '/destinations',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListDestinationsController),
  )
  router.post(
    '/messages/send-widget',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeSendWidgetMessageController),
  )
  router.post(
    '/messages/send-widget-multipart',
    requireThinkzapPermission('connectors', 'update'),
    widgetMessageUploadParser.array('files', 10),
    adaptControllerFactory(makeSendWidgetMessageMultipartController),
  )
  router.get(
    '/contacts',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListContactsController),
  )
  router.get(
    '/groups',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeListGroupsController),
  )
  router.get(
    '/groups/:groupId',
    requireThinkzapPermission('connectors', 'read'),
    adaptControllerFactory(makeGetGroupMetadataController),
  )
  router.post(
    '/groups',
    requireThinkzapPermission('connectors', 'create'),
    adaptControllerFactory(makeCreateGroupController),
  )
  router.patch(
    '/groups/:groupId/name',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateGroupNameController),
  )
  router.patch(
    '/groups/:groupId/description',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateGroupDescriptionController),
  )
  router.patch(
    '/groups/:groupId/photo',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeUpdateGroupPhotoController),
  )
  router.post(
    '/groups/:groupId/participants',
    requireThinkzapPermission('connectors', 'update'),
    adaptControllerFactory(makeAddGroupParticipantsController),
  )
  router.delete(
    '/groups/:groupId/participants',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeRemoveGroupParticipantsController),
  )
  router.delete(
    '/groups/:groupId',
    requireThinkzapPermission('connectors', 'delete'),
    adaptControllerFactory(makeLeaveGroupController),
  )

  return router
}
