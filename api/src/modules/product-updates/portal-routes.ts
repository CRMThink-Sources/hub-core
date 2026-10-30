import { Router } from 'express'
import type { RequestHandler } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { productUpdateImageUpload } from './infra/http/product-update-image-upload.multer'
import {
  createCompleteProductUpdateController,
  createCreateCrmthinkTaskForUpdateController,
  createCreateProductUpdateController,
  createDeleteProductUpdateController,
  createDiscardProductUpdateChangesController,
  createGetProductUpdateController,
  createLinkCrmthinkTaskController,
  createListProductUpdatesController,
  createPublishProductUpdateAsAvailableController,
  createPublishProductUpdateChangesController,
  createPublishProductUpdateController,
  createRemoveProductUpdateImageController,
  createReopenProductUpdateController,
  createSearchCrmthinkTasksController,
  createSearchCrmthinkUsersController,
  createUnlinkCrmthinkTaskController,
  createUnpublishProductUpdateController,
  createUpdateProductUpdateContentController,
  createUploadProductUpdateImageController,
} from './main/factories/create-product-updates-portal-controllers'

/**
 * Novidades do ThinkZap no backoffice, montadas em `/api/portal/novidades`. Todas
 * exigem a sessão do portal. As buscas no Bitrix vêm antes de `/:id` para `bitrix`
 * nunca ser lido como id.
 */
export const createProductUpdatesPortalRoutes = (
  portalAuthMiddleware: RequestHandler,
): Router => {
  const router = Router()

  /** Busca de tarefa (ID ou trecho do título) e de responsável, no Bitrix da CRMThink. */
  router.get(
    '/bitrix/tasks',
    portalAuthMiddleware,
    adaptControllerFactory(createSearchCrmthinkTasksController),
  )
  router.get(
    '/bitrix/users',
    portalAuthMiddleware,
    adaptControllerFactory(createSearchCrmthinkUsersController),
  )

  router.get(
    '/',
    portalAuthMiddleware,
    adaptControllerFactory(createListProductUpdatesController),
  )
  router.post(
    '/',
    portalAuthMiddleware,
    adaptControllerFactory(createCreateProductUpdateController),
  )
  router.get(
    '/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createGetProductUpdateController),
  )
  router.patch(
    '/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createUpdateProductUpdateContentController),
  )
  router.delete(
    '/:id',
    portalAuthMiddleware,
    adaptControllerFactory(createDeleteProductUpdateController),
  )

  /** Multipart com o arquivo em `image` (PNG/JPEG, até 5 MB). */
  router.put(
    '/:id/image',
    portalAuthMiddleware,
    productUpdateImageUpload,
    adaptControllerFactory(createUploadProductUpdateImageController),
  )
  router.delete(
    '/:id/image',
    portalAuthMiddleware,
    adaptControllerFactory(createRemoveProductUpdateImageController),
  )

  /** Ciclo de vida: publicação e conclusão. */
  router.post(
    '/:id/publish',
    portalAuthMiddleware,
    adaptControllerFactory(createPublishProductUpdateController),
  )
  router.post(
    '/:id/publish-available',
    portalAuthMiddleware,
    adaptControllerFactory(createPublishProductUpdateAsAvailableController),
  )
  router.post(
    '/:id/publish-changes',
    portalAuthMiddleware,
    adaptControllerFactory(createPublishProductUpdateChangesController),
  )
  router.post(
    '/:id/discard-changes',
    portalAuthMiddleware,
    adaptControllerFactory(createDiscardProductUpdateChangesController),
  )
  router.post(
    '/:id/unpublish',
    portalAuthMiddleware,
    adaptControllerFactory(createUnpublishProductUpdateController),
  )
  router.post(
    '/:id/complete',
    portalAuthMiddleware,
    adaptControllerFactory(createCompleteProductUpdateController),
  )
  router.post(
    '/:id/reopen',
    portalAuthMiddleware,
    adaptControllerFactory(createReopenProductUpdateController),
  )

  /** Tarefa vinculada: vincular existente, desvincular, criar no Bitrix. */
  router.put(
    '/:id/task',
    portalAuthMiddleware,
    adaptControllerFactory(createLinkCrmthinkTaskController),
  )
  router.delete(
    '/:id/task',
    portalAuthMiddleware,
    adaptControllerFactory(createUnlinkCrmthinkTaskController),
  )
  router.post(
    '/:id/task',
    portalAuthMiddleware,
    adaptControllerFactory(createCreateCrmthinkTaskForUpdateController),
  )

  return router
}
