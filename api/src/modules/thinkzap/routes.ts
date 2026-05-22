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

export const createThinkerszapRoutes = (): Router => {
  const router = Router()

  router.get(
    '/pricing',
    adaptControllerFactory(makeGetThinkzapPricingController),
  )
  router.post(
    '/subscription/billing-portal',
    adaptControllerFactory(makeCreateBillingPortalSessionController),
  )
  router.post(
    '/subscription/end-trial',
    adaptControllerFactory(makeEndTrialSubscriptionController),
  )

  router.post(
    '/subscription/activate-trial',
    adaptControllerFactory(makeActivateTrialController),
  )

  router.post(
    '/subscription/checkout',
    adaptControllerFactory(makeCreateSubscriptionCheckoutController),
  )
  router.get(
    '/subscription/add-quantity-preview',
    adaptControllerFactory(makePreviewAddQuantityController),
  )
  router.post(
    '/subscription/add-quantity',
    adaptControllerFactory(makeAddSubscriptionQuantityController),
  )
  router.get(
    '/connector/list',
    adaptControllerFactory(makeListConnectorsController),
  )
  router.get(
    '/connector/:id/qr-code',
    adaptControllerFactory(makeGetQrCodeController),
  )

  router.post(
    '/connector/disconnect',
    adaptControllerFactory(makeDisconnectConnectorController),
  )
  router.post(
    '/connector/cancel',
    adaptControllerFactory(makeCancelConnectorController),
  )

  router.post(
    '/connector/vinculate-channel',
    adaptControllerFactory(makeVinculateChannelController),
  )

  router.post(
    '/connector/disconnect-channel',
    adaptControllerFactory(makeDisconnectChannelController),
  )

  router.put(
    '/instance/:id',
    adaptControllerFactory(makeUpdateInstanceController),
  )

  router.get(
    '/openchannels',
    adaptControllerFactory(makeListOpenChannelsController),
  )

  router.get(
    '/destinations',
    adaptControllerFactory(makeListDestinationsController),
  )
  router.post(
    '/messages/send-widget',
    adaptControllerFactory(makeSendWidgetMessageController),
  )

  router.get('/contacts', adaptControllerFactory(makeListContactsController))

  router.get('/groups', adaptControllerFactory(makeListGroupsController))
  router.get(
    '/groups/:groupId',
    adaptControllerFactory(makeGetGroupMetadataController),
  )
  router.post('/groups', adaptControllerFactory(makeCreateGroupController))
  router.patch(
    '/groups/:groupId/name',
    adaptControllerFactory(makeUpdateGroupNameController),
  )
  router.patch(
    '/groups/:groupId/description',
    adaptControllerFactory(makeUpdateGroupDescriptionController),
  )
  router.patch(
    '/groups/:groupId/photo',
    adaptControllerFactory(makeUpdateGroupPhotoController),
  )
  router.post(
    '/groups/:groupId/participants',
    adaptControllerFactory(makeAddGroupParticipantsController),
  )
  router.delete(
    '/groups/:groupId/participants',
    adaptControllerFactory(makeRemoveGroupParticipantsController),
  )
  router.delete(
    '/groups/:groupId',
    adaptControllerFactory(makeLeaveGroupController),
  )

  return router
}
