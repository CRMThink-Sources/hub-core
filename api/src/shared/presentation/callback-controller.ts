import axios from 'axios'
import { Request, Response } from 'express'
import { Controller } from './controller'
import { apiLogger, resolveLogApp } from '@/shared/infra/logger'

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
      const app = resolveLogApp(req.originalUrl)
      if (axios.isAxiosError(error)) {
        apiLogger.error(
          {
            app,
            status: error.response?.status,
            data: error.response?.data as unknown,
            url: error.config?.url,
          },
          'Erro do upstream no callback',
        )
      } else {
        apiLogger.error({ app, err: error }, 'Erro inesperado no callback')
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}
