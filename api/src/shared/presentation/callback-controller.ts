import { Request, Response } from 'express'
import { Controller } from './controller'

/**
 * Base para controllers públicos que respondem a callbacks externos (ex: Bitrix BI Builder).
 * Bypassa o wrapper padrão { result, traceId, time } e retorna o body diretamente.
 */
export abstract class CallbackController extends Controller {
  async handle(req: Request, res: Response) {
    try {
      const response = await this.perform(req, res)
      return res.status(response.status).json(response.result)
    } catch (error) {
      console.log({ error })
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}
