import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { createPortalLoginController } from './main/factories/create-portal-login-controller'
import { createPortalSessionController } from './main/factories/create-portal-session-controller'
import { createListPortalDomainsController } from './main/factories/create-list-portal-domains-controller'
import { createGetPortalDomainController } from './main/factories/create-get-portal-domain-controller'
import { createCreatePortalUserController } from './main/factories/create-create-portal-user-controller'
import { createListPortalUsersController } from './main/factories/create-list-portal-users-controller'
import { createRegisterAudioImbotAppController } from './main/factories/create-register-audio-imbot-app-controller'
import { createDeleteAudioImbotAppController } from './main/factories/create-delete-audio-imbot-app-controller'
import { createRegisterConversationWidgetAppController } from './main/factories/create-register-conversation-widget-app-controller'
import { createDeleteConversationWidgetAppController } from './main/factories/create-delete-conversation-widget-app-controller'
import { createRegisterBizprocRobotAppController } from './main/factories/create-register-bizproc-robot-app-controller'
import { createDeleteBizprocRobotAppController } from './main/factories/create-delete-bizproc-robot-app-controller'
import { createListPlacementsAppController } from './main/factories/create-list-placements-app-controller'
import { createListBizprocRobotsAppController } from './main/factories/create-list-bizproc-robots-app-controller'
import { createRegisterSpaWidgetAppController } from './main/factories/create-register-spa-widget-app-controller'
import { createDeleteSpaWidgetAppController } from './main/factories/create-delete-spa-widget-app-controller'
import { createListThinkzapInstancesAppController } from './main/factories/create-list-thinkzap-instances-app-controller'
import { createSubscribeThinkzapInstanceController } from './main/factories/create-subscribe-thinkzap-instance-controller'
import { createUnsubscribeThinkzapInstanceController } from './main/factories/create-unsubscribe-thinkzap-instance-controller'
import { createUpdateThinkzapInstanceNameController } from './main/factories/create-update-thinkzap-instance-name-controller'
import { createUpdateThinkzapConnectorEventBindsAppController } from './main/factories/create-update-thinkzap-connector-event-binds-app-controller'
import { createReactivateThinkzapConnectorController } from './main/factories/create-reactivate-thinkzap-connector-controller'
import { createListSubscriptionsAppController } from './main/factories/create-list-subscriptions-app-controller'
import { createExtendSubscriptionTrialController } from './main/factories/create-extend-subscription-trial-controller'
import { createCancelSubscriptionTrialController } from './main/factories/create-cancel-subscription-trial-controller'
import { createCreateTrialSubscriptionAppController } from './main/factories/create-create-trial-subscription-app-controller'
import { createCreateSubscriptionAppController } from './main/factories/create-create-subscription-app-controller'
import { createCancelSubscriptionController } from './main/factories/create-cancel-subscription-controller'
import type { RequestHandler } from 'express'

export const createPortalRoutes = (
  portalAuthMiddleware: RequestHandler,
): Router => {
  const router = Router()

  router.post(
    '/auth/login',
    adaptControllerFactory(createPortalLoginController),
  )
  router.get(
    '/auth/session',
    portalAuthMiddleware,
    adaptControllerFactory(createPortalSessionController),
  )
  router.get(
    '/domains',
    portalAuthMiddleware,
    adaptControllerFactory(createListPortalDomainsController),
  )
  router.get(
    '/domains/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createGetPortalDomainController),
  )
  router.get(
    '/users',
    portalAuthMiddleware,
    adaptControllerFactory(createListPortalUsersController),
  )
  router.post(
    '/users',
    portalAuthMiddleware,
    adaptControllerFactory(createCreatePortalUserController),
  )
  router.post(
    '/apps/:appId/audio-imbot',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterAudioImbotAppController),
  )
  router.delete(
    '/apps/:appId/audio-imbot',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteAudioImbotAppController),
  )
  router.post(
    '/apps/:appId/conversation-widget',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterConversationWidgetAppController),
  )
  router.delete(
    '/apps/:appId/conversation-widget',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteConversationWidgetAppController),
  )
  router.post(
    '/apps/:appId/bizproc-robot',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterBizprocRobotAppController),
  )
  router.delete(
    '/apps/:appId/bizproc-robot',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteBizprocRobotAppController),
  )
  router.get(
    '/apps/:appId/placements',
    portalAuthMiddleware,
    adaptControllerFactory(createListPlacementsAppController),
  )
  router.get(
    '/apps/:appId/bizproc-robots',
    portalAuthMiddleware,
    adaptControllerFactory(createListBizprocRobotsAppController),
  )
  router.post(
    '/apps/:appId/spa-placements',
    portalAuthMiddleware,
    adaptControllerFactory(createRegisterSpaWidgetAppController),
  )
  router.delete(
    '/apps/:appId/spa-placements',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteSpaWidgetAppController),
  )
  router.get(
    '/apps/:appId/thinkzap-instances',
    portalAuthMiddleware,
    adaptControllerFactory(createListThinkzapInstancesAppController),
  )
  router.post(
    '/apps/:appId/thinkzap-instances/:instanceDbId/subscribe',
    portalAuthMiddleware,
    adaptControllerFactory(createSubscribeThinkzapInstanceController),
  )
  router.post(
    '/apps/:appId/thinkzap-instances/:instanceDbId/unsubscribe',
    portalAuthMiddleware,
    adaptControllerFactory(createUnsubscribeThinkzapInstanceController),
  )
  router.patch(
    '/apps/:appId/thinkzap-instances/:instanceDbId/name',
    portalAuthMiddleware,
    adaptControllerFactory(createUpdateThinkzapInstanceNameController),
  )
  router.patch(
    '/apps/:appId/thinkzap-connectors/:connectorId/event-binds',
    portalAuthMiddleware,
    adaptControllerFactory(
      createUpdateThinkzapConnectorEventBindsAppController,
    ),
  )
  router.patch(
    '/apps/:appId/thinkzap-connectors/:connectorId/reactivate',
    portalAuthMiddleware,
    adaptControllerFactory(createReactivateThinkzapConnectorController),
  )
  router.get(
    '/apps/:appId/subscriptions',
    portalAuthMiddleware,
    adaptControllerFactory(createListSubscriptionsAppController),
  )
  router.patch(
    '/apps/:appId/subscriptions/:subscriptionId/trial-end-date',
    portalAuthMiddleware,
    adaptControllerFactory(createExtendSubscriptionTrialController),
  )
  router.delete(
    '/apps/:appId/subscriptions/:subscriptionId/trial',
    portalAuthMiddleware,
    adaptControllerFactory(createCancelSubscriptionTrialController),
  )
  router.post(
    '/apps/:appId/subscriptions/trial',
    portalAuthMiddleware,
    adaptControllerFactory(createCreateTrialSubscriptionAppController),
  )
  router.post(
    '/apps/:appId/subscriptions',
    portalAuthMiddleware,
    adaptControllerFactory(createCreateSubscriptionAppController),
  )
  router.post(
    '/apps/:appId/subscriptions/:subscriptionId/cancel',
    portalAuthMiddleware,
    adaptControllerFactory(createCancelSubscriptionController),
  )

  return router
}
