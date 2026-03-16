import { Router } from 'express'
import { createInstallController } from './main/factories/create-install-controller'
import { createLoginController } from './main/factories/create-login-controller'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeCreateSessionController } from './main/factories/make-create-session-controller'
import { authMiddleware } from '@/composition-root'

export const createAuthRoutes = (): Router => {
  const router = Router()

  router.post('/', createLoginController().handle)
  router.post('/install', createInstallController().handle)

  router.use(authMiddleware)
  router.get('/session', adaptControllerFactory(makeCreateSessionController))

  return router
}
