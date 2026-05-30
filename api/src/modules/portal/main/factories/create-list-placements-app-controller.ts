import { Controller } from '@/shared/presentation/controller'
import { ListPlacementsAppController } from '../../presentation/controllers/list-placements-app-controller'

export const createListPlacementsAppController = (): Controller => {
  return new ListPlacementsAppController()
}
