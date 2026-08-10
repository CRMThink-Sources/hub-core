import axios from 'axios'
import { Request, Response } from 'express'
import { Controller } from './controller'
import { apiLogger, resolveLogApp } from '@/shared/infra/logger'
import { AppError } from '@/shared/domain/errors/app-error'
import { appErrorLogFields } from '@/shared/infra/log-error'

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
      // AppError carrega errorCode → casa com runbook/MCP. <500 = warn, >=500 = error.
      if (error instanceof AppError) {
        const level = error.httpStatus >= 500 ? 'error' : 'warn'
        apiLogger[level](appErrorLogFields(error, { app }), error.userCause)
        return res.status(error.httpStatus).json({ error: error.userCause })
      }
      if (axios.isAxiosError(error)) {
        apiLogger.error(
          {
            app,
            errorCode: 'UNCLASSIFIED',
            status: error.response?.status,
            data: error.response?.data as unknown,
            url: error.config?.url,
          },
          'Erro do upstream no callback',
        )
      } else {
        apiLogger.error(
          { app, errorCode: 'UNCLASSIFIED', err: error },
          'Erro inesperado no callback',
        )
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}
