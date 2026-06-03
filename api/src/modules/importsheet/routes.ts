import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import {
  makeGoogleOAuthUrlController,
  makeGoogleDisconnectController,
  makeGetSpreadsheetController,
} from './main/make-google-oauth-controllers'
import {
  makeGetSheetHeaderController,
  makeListBitrixEntitiesController,
  makeListBitrixCategoriesController,
  makeListBitrixFieldsController,
} from './main/make-importsheet-controllers'
import { requireImportSheetApp } from './infra/middleware/require-importsheet-app'

export const createImportSheetRoutes = (): Router => {
  const router = Router()

  // Todas as rotas authed deste módulo são exclusivas do app ImportSheet.
  router.use(requireImportSheetApp)

  // Google OAuth
  router.get(
    '/oauth/google/url',
    adaptControllerFactory(makeGoogleOAuthUrlController),
  )
  router.post(
    '/oauth/google/disconnect',
    adaptControllerFactory(makeGoogleDisconnectController),
  )

  // Planilhas — validação/leitura por ID (sem listagem, evita vazar planilhas de terceiros)
  router.get(
    '/sheets/:spreadsheetId',
    adaptControllerFactory(makeGetSpreadsheetController),
  )
  // Cabeçalho (1ª linha) de uma aba — base pro de-para
  router.get(
    '/sheets/:spreadsheetId/header',
    adaptControllerFactory(makeGetSheetHeaderController),
  )

  // Metadados de CRM do Bitrix24 (entidade-alvo + pipelines + campos do de-para)
  router.get(
    '/bitrix/entities',
    adaptControllerFactory(makeListBitrixEntitiesController),
  )
  router.get(
    '/bitrix/categories',
    adaptControllerFactory(makeListBitrixCategoriesController),
  )
  router.get(
    '/bitrix/fields',
    adaptControllerFactory(makeListBitrixFieldsController),
  )

  return router
}
