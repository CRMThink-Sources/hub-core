import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { subscribeThinkzapInstance } from '../../application/subscribe-thinkzap-instance'
import {
  ThinkzapInstanceNoTokenError,
  ThinkzapInstanceNotFoundError,
} from '../../application/subscribe-thinkzap-instance'

export class SubscribeThinkzapInstanceController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { instanceDbId } = req.params as { instanceDbId: string }

    try {
      await subscribeThinkzapInstance(instanceDbId)
      return this.ok({ message: 'Subscribed' })
    } catch (error) {
      if (error instanceof ThinkzapInstanceNotFoundError)
        return this.notFound(error)
      if (error instanceof ThinkzapInstanceNoTokenError)
        return { status: 422, result: { error: error.message } }
      throw error
    }
  }
}
