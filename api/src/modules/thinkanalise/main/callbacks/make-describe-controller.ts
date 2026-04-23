import { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { DescribeController } from '../../presentation/controllers/callbacks/describe.controller'

export const makeDescribeController = (_req: Request): Controller => {
  return new DescribeController()
}
