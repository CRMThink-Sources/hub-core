import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { createPortalLoginController } from './main/factories/create-portal-login-controller'
import { createPortalSessionController } from './main/factories/create-portal-session-controller'
import { createListPortalDomainsController } from './main/factories/create-list-portal-domains-controller'
import { createGetPortalDomainController } from './main/factories/create-get-portal-domain-controller'
import { createCreatePortalUserController } from './main/factories/create-create-portal-user-controller'
import { createRegisterAudioImbotAppController } from './main/factories/create-register-audio-imbot-app-controller'
import { createDeleteAudioImbotAppController } from './main/factories/create-delete-audio-imbot-app-controller'
import { createRegisterConversationWidgetAppController } from './main/factories/create-register-conversation-widget-app-controller'
import { createDeleteConversationWidgetAppController } from './main/factories/create-delete-conversation-widget-app-controller'
import { createRegisterBizprocRobotAppController } from './main/factories/create-register-bizproc-robot-app-controller'
import { createDeleteBizprocRobotAppController } from './main/factories/create-delete-bizproc-robot-app-controller'
import { createListPlacementsAppController } from './main/factories/create-list-placements-app-controller'
import { createListBizprocRobotsAppController } from './main/factories/create-list-bizproc-robots-app-controller'
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

  return router
}
