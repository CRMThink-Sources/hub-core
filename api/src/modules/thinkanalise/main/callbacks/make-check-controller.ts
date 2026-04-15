import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { CheckController } from '../../presentation/controllers/callbacks/check.controller'

export const makeCheckController = (_req: Request): Controller => {
  return new CheckController()
}
