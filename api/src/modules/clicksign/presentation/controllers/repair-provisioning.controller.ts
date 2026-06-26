import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
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
    const status = await new ProvisioningService(
      this.bitrix,
      this.webhookCtx,
    ).repair()
    return this.ok(status)
  }
}
