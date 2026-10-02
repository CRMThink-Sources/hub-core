import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { apiLogger } from '@/shared/infra/logger'
import { logImportsheetError } from '../../errors/catalog'
import { BitrixCrmMetaService } from '../../application/bitrix-crm-meta.service'

export class ListBitrixEntitiesController extends Controller {
  constructor(private readonly meta: BitrixCrmMetaService) {
    super()
  }

  async perform(_req: Request): Promise<httpResponse> {
    try {
      const entities = await this.meta.listEntities()
      return this.ok({ entities })
    } catch (error) {
      if (error instanceof BitrixError) {
        logImportsheetError(apiLogger, 'importsheet.bitrix.field_meta_error', {
          app: 'importsheet',
          err: error,
        })
        return this.badRequest(error)
      }
      throw error
    }
  }
}
