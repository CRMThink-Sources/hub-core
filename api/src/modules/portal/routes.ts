import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { createPortalLoginController } from './main/factories/create-portal-login-controller'
import { createPortalSessionController } from './main/factories/create-portal-session-controller'
import { createListPortalDomainsController } from './main/factories/create-list-portal-domains-controller'
import { createGetPortalDomainController } from './main/factories/create-get-portal-domain-controller'
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

  return router
}
