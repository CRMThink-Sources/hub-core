import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { unsubscribeThinkzapInstance } from '../../application/unsubscribe-thinkzap-instance'
import {
  ThinkzapInstanceNoTokenError,
  ThinkzapInstanceNotFoundError,
} from '../../application/subscribe-thinkzap-instance'

export class UnsubscribeThinkzapInstanceController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { instanceDbId } = req.params as { instanceDbId: string }

    try {
      await unsubscribeThinkzapInstance(instanceDbId)
      return this.ok({ message: 'Unsubscribed' })
    } catch (error) {
      if (error instanceof ThinkzapInstanceNotFoundError)
        return this.notFound(error)
      if (error instanceof ThinkzapInstanceNoTokenError)
        return { status: 422, result: { error: (error as Error).message } }
      throw error
    }
  }
}
