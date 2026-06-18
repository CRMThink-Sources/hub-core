import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { ClickSignBitrixFieldsService } from '../../application/bitrix-fields.service'

export class ListFieldsController extends Controller {
  constructor(private readonly fields: ClickSignBitrixFieldsService) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const entity = Array.isArray(req.query.entity)
      ? req.query.entity[0]
      : req.query.entity
    try {
      if (entity === 'contact') {
        return this.ok({ fields: await this.fields.listContactFields() })
      }
      if (entity === 'deal') {
        return this.ok({ fields: await this.fields.listDealFields() })
      }
      return this.badRequest(new Error('Invalid entity (use deal|contact)'))
    } catch (error) {
      if (error instanceof BitrixError) return this.badRequest(error)
      throw error
    }
  }
}
