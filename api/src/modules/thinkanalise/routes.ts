import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeAddBiconnectorController } from './main/make-add-biconnector-controller'
import { makeListBiconnectorsController } from './main/make-list-biconnectors-controller'
import { makeDeleteBiconnectorController } from './main/make-delete-biconnector-controller'
import { makeUpdateBiconnectorController } from './main/make-update-biconnector-controller'
import {
  makeAddSourceController,
  makeListSourcesController,
  makeUpdateSourceController,
  makeDeleteSourceController,
} from './main/make-source-controllers'
import {
  makeContaAzulOAuthStartController,
  makeContaAzulOAuthCallbackController,
} from './main/make-conta-azul-oauth-controllers'
import {
  makeBlingOAuthStartController,
  makeBlingOAuthCallbackController,
} from './main/make-bling-oauth-controllers'
import {
  makeAddDatasetController,
  makeListDatasetsController,
  makeUpdateDatasetController,
  makeSyncDatasetFieldsController,
  makeDeleteDatasetController,
} from './main/make-dataset-controllers'

export const createThinkAnaliseRoutes = (): Router => {
  const router = Router()

  // Connectors
  router.post(
    '/connector',
    adaptControllerFactory(makeAddBiconnectorController),
  )
  router.get(
    '/connectors',
    adaptControllerFactory(makeListBiconnectorsController),
  )
  router.put(
    '/connector/:id',
    adaptControllerFactory(makeUpdateBiconnectorController),
  )
  router.delete(
    '/connector/:id',
    adaptControllerFactory(makeDeleteBiconnectorController),
  )

  // Sources
  router.post(
    '/connector/:connectorId/source',
    adaptControllerFactory(makeAddSourceController),
  )
  router.get(
    '/connector/:connectorId/sources',
    adaptControllerFactory(makeListSourcesController),
  )
  router.put('/source/:id', adaptControllerFactory(makeUpdateSourceController))
  router.delete(
    '/source/:id',
    adaptControllerFactory(makeDeleteSourceController),
  )

  // OAuth
  router.get(
    '/oauth/conta-azul/start',
    adaptControllerFactory(makeContaAzulOAuthStartController),
  )
  router.get(
    '/oauth/conta-azul/callback',
    adaptControllerFactory(makeContaAzulOAuthCallbackController),
  )
  router.get(
    '/oauth/bling/start',
    adaptControllerFactory(makeBlingOAuthStartController),
  )
  router.get(
    '/oauth/bling/callback',
    adaptControllerFactory(makeBlingOAuthCallbackController),
  )

  // Datasets
  router.post(
    '/source/:sourceId/dataset',
    adaptControllerFactory(makeAddDatasetController),
  )
  router.get(
    '/source/:sourceId/datasets',
    adaptControllerFactory(makeListDatasetsController),
  )
  router.put(
    '/dataset/:id',
    adaptControllerFactory(makeUpdateDatasetController),
  )
  router.put(
    '/dataset/:id/fields',
    adaptControllerFactory(makeSyncDatasetFieldsController),
  )
  router.delete(
    '/dataset/:id',
    adaptControllerFactory(makeDeleteDatasetController),
  )

  return router
}
