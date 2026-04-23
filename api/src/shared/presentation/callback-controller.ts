import axios from 'axios'
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
      if (axios.isAxiosError(error)) {
        console.error('[CallbackController] HTTP error from upstream:', {
          status: error.response?.status,
          data: error.response?.data as unknown,
          url: error.config?.url,
        })
      } else {
        console.error('[CallbackController] Unexpected error:', error)
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}
