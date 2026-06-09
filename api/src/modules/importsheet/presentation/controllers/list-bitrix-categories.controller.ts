import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { BitrixCrmMetaService } from '../../application/bitrix-crm-meta.service'
import { parseEntityTypeId } from './parse-entity-type-id'

export class ListBitrixCategoriesController extends Controller {
  constructor(private readonly meta: BitrixCrmMetaService) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const entityTypeId = parseEntityTypeId(req.query.entityTypeId)
    if (entityTypeId === null) {
      return this.badRequest(new Error('Missing or invalid entityTypeId'))
    }
    try {
      const categories = await this.meta.listCategories(entityTypeId)
      return this.ok({ categories })
    } catch (error) {
      if (error instanceof BitrixError) return this.badRequest(error)
      throw error
    }
  }
}
