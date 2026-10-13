import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { ClickSignBitrixFieldsService } from '../../application/bitrix-fields.service'
import { clicksignError, logClicksignError } from '../../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

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
      logClicksignError(apiLogger, 'clicksign.fields.entity_invalid', {
        app: 'clicksign',
        entity,
      })
      return this.badRequest(new Error('Invalid entity (use deal|contact)'))
    } catch (error) {
      if (error instanceof BitrixError)
        throw clicksignError('clicksign.fields.bitrix_error', error)
      throw error
    }
  }
}
