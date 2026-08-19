import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ThinkzapLineCredentialMissingError } from '../../application/subscribe-thinkzap-line'
import { updateThinkzapLineName } from '../../application/update-thinkzap-line-name'
import { mapAdminLineError } from '../map-admin-line-error'

export class UpdateThinkzapLineNameController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionItemId } = req.params as {
      appId: string
      subscriptionItemId: string
    }
    const { name } = req.body as { name: unknown }

    if (!name || typeof name !== 'string') {
      return this.badRequest(new Error('name is required'))
    }

    try {
      await updateThinkzapLineName(appId, subscriptionItemId, name)
      return this.ok({ message: 'Instance name updated' })
    } catch (error) {
      const mapped = mapAdminLineError(error)
      if (mapped) return mapped
      if (error instanceof ThinkzapLineCredentialMissingError)
        return { status: 422, result: { error: error.message } }
      throw error
    }
  }
}
