import { Controller } from '@/shared/presentation/controller'
import { CompleteProductUpdate } from '../../application/complete-product-update'
import { CreateCrmthinkTaskForUpdate } from '../../application/create-crmthink-task-for-update'
import { CreateProductUpdate } from '../../application/create-product-update'
import { DeleteProductUpdate } from '../../application/delete-product-update'
import { DiscardProductUpdateChanges } from '../../application/discard-product-update-changes'
import { GetProductUpdate } from '../../application/get-product-update'
import type { ProductUpdateActionInput } from '../../application/helpers/product-update-actions'
import { LinkCrmthinkTask } from '../../application/link-crmthink-task'
import { ListProductUpdates } from '../../application/list-product-updates'
import { PublishProductUpdate } from '../../application/publish-product-update'
import { PublishProductUpdateAsAvailable } from '../../application/publish-product-update-as-available'
import { PublishProductUpdateChanges } from '../../application/publish-product-update-changes'
import { RemoveProductUpdateImage } from '../../application/remove-product-update-image'
import { ReopenProductUpdate } from '../../application/reopen-product-update'
import { SearchCrmthinkTasks } from '../../application/search-crmthink-tasks'
import { SearchCrmthinkUsers } from '../../application/search-crmthink-users'
import { UnlinkCrmthinkTask } from '../../application/unlink-crmthink-task'
import { UnpublishProductUpdate } from '../../application/unpublish-product-update'
import { UpdateProductUpdateContent } from '../../application/update-product-update-content'
import { UploadProductUpdateImage } from '../../application/upload-product-update-image'
import type { ProductUpdate } from '../../domain/entities/product-update'
import type { ProductUpdateRepository } from '../../domain/repositories/product-update.repository'
import { PrismaProductUpdateRepository } from '../../infra/persistence/prisma-product-update.repository'
import {
  CompleteProductUpdateController,
  CreateCrmthinkTaskForUpdateController,
  CreateProductUpdateController,
  DeleteProductUpdateController,
  LinkCrmthinkTaskController,
  ListProductUpdatesController,
  ProductUpdateActionController,
  SearchCrmthinkTasksController,
  SearchCrmthinkUsersController,
  UpdateProductUpdateContentController,
  UploadProductUpdateImageController,
} from '../../presentation/controllers/product-updates-portal-controllers'
import {
  makeCreateCrmthinkTaskConfig,
  makeCrmthinkTasksConfig,
  makeCrmthinkTasksGateway,
} from '../make-crmthink-tasks-gateway'
import {
  makeProductUpdateImageStorage,
  makeProductUpdateImageUrlResolver,
} from '../make-product-update-image-storage'

const repository = (): ProductUpdateRepository =>
  new PrismaProductUpdateRepository()

/** Ação "novidade + quem age → novidade", respondida como view. */
const action = (
  build: (repository: ProductUpdateRepository) => {
    execute(input: ProductUpdateActionInput): Promise<ProductUpdate>
  },
): (() => Controller) => {
  return () => {
    const useCase = build(repository())
    return new ProductUpdateActionController(
      input => useCase.execute(input),
      makeProductUpdateImageUrlResolver(),
    )
  }
}

export const createListProductUpdatesController = (): Controller =>
  new ListProductUpdatesController(new ListProductUpdates(repository()))

export const createGetProductUpdateController = (): Controller => {
  const get = new GetProductUpdate(repository())
  return new ProductUpdateActionController(
    input => get.execute(input.id),
    makeProductUpdateImageUrlResolver(),
  )
}

export const createCreateProductUpdateController = (): Controller =>
  new CreateProductUpdateController(
    new CreateProductUpdate(repository()),
    makeProductUpdateImageUrlResolver(),
  )

export const createUpdateProductUpdateContentController = (): Controller =>
  new UpdateProductUpdateContentController(
    new UpdateProductUpdateContent(repository()),
    makeProductUpdateImageUrlResolver(),
  )

export const createDeleteProductUpdateController = (): Controller =>
  new DeleteProductUpdateController(new DeleteProductUpdate(repository()))

/** Sem R2, o storage é `null` e o caso de uso responde `503`. */
export const createUploadProductUpdateImageController = (): Controller =>
  new UploadProductUpdateImageController(
    new UploadProductUpdateImage(repository(), makeProductUpdateImageStorage()),
    makeProductUpdateImageUrlResolver(),
  )

export const createRemoveProductUpdateImageController = action(
  r => new RemoveProductUpdateImage(r),
)
export const createPublishProductUpdateController = action(
  r => new PublishProductUpdate(r),
)
export const createPublishProductUpdateAsAvailableController = action(
  r => new PublishProductUpdateAsAvailable(r),
)
export const createPublishProductUpdateChangesController = action(
  r => new PublishProductUpdateChanges(r),
)
export const createDiscardProductUpdateChangesController = action(
  r => new DiscardProductUpdateChanges(r),
)
export const createUnpublishProductUpdateController = action(
  r => new UnpublishProductUpdate(r),
)
export const createReopenProductUpdateController = action(
  r =>
    new ReopenProductUpdate(
      r,
      makeCrmthinkTasksGateway(),
      makeCrmthinkTasksConfig(),
    ),
)
export const createUnlinkCrmthinkTaskController = action(
  r => new UnlinkCrmthinkTask(r),
)

export const createCompleteProductUpdateController = (): Controller =>
  new CompleteProductUpdateController(
    new CompleteProductUpdate(
      repository(),
      makeCrmthinkTasksGateway(),
      makeCrmthinkTasksConfig(),
    ),
    makeProductUpdateImageUrlResolver(),
  )

export const createLinkCrmthinkTaskController = (): Controller =>
  new LinkCrmthinkTaskController(
    new LinkCrmthinkTask(repository(), makeCrmthinkTasksGateway()),
    makeProductUpdateImageUrlResolver(),
  )

export const createCreateCrmthinkTaskForUpdateController = (): Controller =>
  new CreateCrmthinkTaskForUpdateController(
    new CreateCrmthinkTaskForUpdate(
      repository(),
      makeCrmthinkTasksGateway(),
      makeCreateCrmthinkTaskConfig(),
    ),
    makeProductUpdateImageUrlResolver(),
  )

export const createSearchCrmthinkTasksController = (): Controller =>
  new SearchCrmthinkTasksController(
    new SearchCrmthinkTasks(
      makeCrmthinkTasksGateway(),
      makeCrmthinkTasksConfig(),
    ),
  )

export const createSearchCrmthinkUsersController = (): Controller =>
  new SearchCrmthinkUsersController(
    new SearchCrmthinkUsers(makeCrmthinkTasksGateway()),
  )
