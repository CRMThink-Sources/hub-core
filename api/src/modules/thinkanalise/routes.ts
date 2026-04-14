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

  return router
}
