import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import {
  makeGoogleOAuthUrlController,
  makeGoogleDisconnectController,
} from './main/make-google-oauth-controllers'

export const createImportSheetRoutes = (): Router => {
  const router = Router()

  // Google OAuth
  router.get(
    '/oauth/google/url',
    adaptControllerFactory(makeGoogleOAuthUrlController),
  )
  router.post(
    '/oauth/google/disconnect',
    adaptControllerFactory(makeGoogleDisconnectController),
  )

  return router
}
