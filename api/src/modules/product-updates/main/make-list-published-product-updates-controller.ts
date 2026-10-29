import { Controller } from '@/shared/presentation/controller'
import { ListPublishedProductUpdates } from '../application/list-published-product-updates'
import { PrismaProductUpdateRepository } from '../infra/persistence/prisma-product-update.repository'
import { ListPublishedProductUpdatesController } from '../presentation/controllers/list-published-product-updates.controller'
import { makeProductUpdateImageUrlResolver } from './make-product-update-image-storage'

export const makeListPublishedProductUpdatesController = (): Controller =>
  new ListPublishedProductUpdatesController(
    new ListPublishedProductUpdates(
      new PrismaProductUpdateRepository(),
      makeProductUpdateImageUrlResolver(),
    ),
  )
