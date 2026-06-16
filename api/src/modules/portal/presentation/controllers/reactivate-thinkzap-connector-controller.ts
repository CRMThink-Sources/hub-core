import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  reactivateThinkzapConnector,
  ThinkzapConnectorNotFoundError,
  ThinkzapConnectorNotInactiveError,
} from '../../application/reactivate-thinkzap-connector'

export class ReactivateThinkzapConnectorController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, connectorId } = req.params as {
      appId: string
      connectorId: string
    }

    try {
      await reactivateThinkzapConnector(connectorId, appId)
      return this.ok({ message: 'Connector reactivated' })
    } catch (error) {
      if (error instanceof ThinkzapConnectorNotFoundError)
        return this.notFound(error)
      if (error instanceof ThinkzapConnectorNotInactiveError) {
        return { status: 422, result: { error: (error as Error).message } }
      }
      throw error
    }
  }
}
