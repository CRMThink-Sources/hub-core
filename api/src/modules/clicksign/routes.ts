import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import {
  makeListFieldsController,
  makeListUsersController,
  makeGetSettingsController,
  makeUpdateSettingsController,
  makeVerifyProvisioningController,
  makeRepairProvisioningController,
} from './main/make-clicksign-controllers'
import { requireClickSignApp } from './infra/middleware/require-clicksign-app'

export const createClickSignRoutes = (): Router => {
  const router = Router()

  router.use(requireClickSignApp)

  router.get('/bitrix/fields', adaptControllerFactory(makeListFieldsController))
  router.get('/bitrix/users', adaptControllerFactory(makeListUsersController))

  router.get('/settings', adaptControllerFactory(makeGetSettingsController))
  router.patch(
    '/settings',
    adaptControllerFactory(makeUpdateSettingsController),
  )

  router.get(
    '/provisioning',
    adaptControllerFactory(makeVerifyProvisioningController),
  )
  router.post(
    '/provisioning/repair',
    adaptControllerFactory(makeRepairProvisioningController),
  )

  return router
}
