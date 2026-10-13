import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { apiLogger } from '@/shared/infra/logger'
import { logClicksignError } from '../../errors/catalog'
import { safeErrorMessage } from '../../infra/clients/clicksign-error'
import {
  ProvisioningService,
  WebhookContext,
} from '../../application/provisioning.service'

export class RepairProvisioningController extends Controller {
  constructor(
    private readonly bitrix: BitrixClient,
    private readonly webhookCtx?: WebhookContext,
  ) {
    super()
  }

  async perform(_req: Request, _res: Response): Promise<httpResponse> {
    try {
      const status = await new ProvisioningService(
        this.bitrix,
        this.webhookCtx,
      ).repair()
      return this.ok(status)
    } catch (error) {
      // BitrixError cai no funil como 400 sem log.
      if (error instanceof BitrixError) {
        logClicksignError(apiLogger, 'clicksign.provisioning.bitrix_error', {
          app: 'clicksign',
          err: safeErrorMessage(error),
        })
      }
      throw error
    }
  }
}
