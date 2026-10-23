import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { Request, Response } from 'express'
import type { ConnectorAtivoPort } from './bot-flow-binding.controllers'

/** A tela do ThinkBot bloqueia sem conector: o runtime já não atenderia. */
export class GetThinkbotConnectorStatusController extends Controller {
  constructor(private readonly connectorAtivo: ConnectorAtivoPort) {
    super()
  }

  async perform(_req: Request, _res: Response): Promise<httpResponse> {
    return this.ok({ active: await this.connectorAtivo() })
  }
}
