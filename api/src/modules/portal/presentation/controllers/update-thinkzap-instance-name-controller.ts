import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { updateThinkzapInstanceName } from '../../application/update-thinkzap-instance-name'
import {
  ThinkzapInstanceNoTokenError,
  ThinkzapInstanceNotFoundError,
} from '../../application/subscribe-thinkzap-instance'

export class UpdateThinkzapInstanceNameController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { instanceDbId } = req.params as { instanceDbId: string }
    const { name } = req.body as { name: unknown }

    if (!name || typeof name !== 'string') {
      return this.badRequest(new Error('name is required'))
    }

    try {
      await updateThinkzapInstanceName(instanceDbId, name)
      return this.ok({ message: 'Instance name updated' })
    } catch (error) {
      if (error instanceof ThinkzapInstanceNotFoundError)
        return this.notFound(error)
      if (error instanceof ThinkzapInstanceNoTokenError)
        return { status: 422, result: { error: (error as Error).message } }
      throw error
    }
  }
}
