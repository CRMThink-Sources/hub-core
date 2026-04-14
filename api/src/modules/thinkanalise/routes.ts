import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeAddBiconnectorController } from './main/make-add-biconnector-controller'
import { makeListBiconnectorsController } from './main/make-list-biconnectors-controller'
import { makeDeleteBiconnectorController } from './main/make-delete-biconnector-controller'
import { makeUpdateBiconnectorController } from './main/make-update-biconnector-controller'

export const createThinkAnaliseRoutes = (): Router => {
  const router = Router()

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

  return router
}
