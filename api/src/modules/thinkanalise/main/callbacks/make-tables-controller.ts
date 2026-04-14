import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { TablesController } from '../../presentation/controllers/callbacks/tables.controller'

export const makeTablesController = (_req: Request): Controller => {
  return new TablesController()
}
