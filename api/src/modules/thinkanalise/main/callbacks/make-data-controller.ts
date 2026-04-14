import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { DataController } from '../../presentation/controllers/callbacks/data.controller'

export const makeDataController = (_req: Request): Controller => {
  return new DataController()
}
