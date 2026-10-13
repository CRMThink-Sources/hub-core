import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { apiLogger } from '@/shared/infra/logger'
import { logImportsheetError } from '../../errors/catalog'
import { BitrixCrmMetaService } from '../../application/bitrix-crm-meta.service'
import { parseEntityTypeId } from './parse-entity-type-id'

export class ListBitrixFieldsController extends Controller {
  constructor(private readonly meta: BitrixCrmMetaService) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const entityCode = this.readEntityCode(req.query.entityCode)
    try {
      if (entityCode === 'TASK') {
        return this.ok({ fields: await this.meta.listTaskFields() })
      }
      const entityTypeId = parseEntityTypeId(req.query.entityTypeId)
      if (entityTypeId === null) {
        return this.badRequest(new Error('Missing or invalid entityTypeId'))
      }
      return this.ok({ fields: await this.meta.listFields(entityTypeId) })
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

  private readEntityCode(raw: unknown): string | null {
    const value: unknown = Array.isArray(raw) ? (raw[0] as unknown) : raw
    return typeof value === 'string' ? value.trim().toUpperCase() : null
  }
}
