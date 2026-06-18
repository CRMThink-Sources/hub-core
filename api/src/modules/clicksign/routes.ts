import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import {
  makeListFieldsController,
  makeListUsersController,
} from './main/make-clicksign-controllers'
import { requireClickSignApp } from './infra/middleware/require-clicksign-app'

export const createClickSignRoutes = (): Router => {
  const router = Router()

  // Todas as rotas authed deste módulo são exclusivas do app Clicksign.
  router.use(requireClickSignApp)

  // Campos de CRM (deal|contact) — base dos selects de configuração
  router.get('/bitrix/fields', adaptControllerFactory(makeListFieldsController))
  // Usuários ativos do portal — participantes da assinatura
  router.get('/bitrix/users', adaptControllerFactory(makeListUsersController))

  return router
}
