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
import { makeGetLogsControllerFactory } from '@/shared/main/make-get-logs-controller'

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

  // Logs (Loki) — restrito ao app + domínio do token, resolvido no servidor.
  router.get(
    '/logs',
    adaptControllerFactory(makeGetLogsControllerFactory('clicksign')),
  )

  return router
}
