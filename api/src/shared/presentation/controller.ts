import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { randomUUID } from 'crypto'
import { BitrixError } from '../infra/clients/errors/bitrix-client.error'

export abstract class Controller {
  constructor() {
    this.handle = this.handle.bind(this)
  }

  abstract perform(req: Request, res: Response): Promise<httpResponse>

  protected badRequest(error: Error): httpResponse {
    return { status: 400, result: { error: error.message } }
  }

  protected unauthorized(error: Error): httpResponse {
    return { status: 401, result: { error: error.message } }
  }

  protected notFound(error: Error): httpResponse {
    return { status: 404, result: { error: error.message } }
  }

  protected conflict(error: Error): httpResponse {
    return { status: 409, result: { error: error.message } }
  }

  protected gatewayTimeout(error: Error): httpResponse {
    return { status: 504, result: { error: error.message } }
  }

  protected ok(data: unknown): httpResponse {
    return { status: 200, result: data }
  }

  async handle(req: Request, res: Response) {
    const initTime = Date.now()
    const traceId = randomUUID()
    try {
      const response = await this.perform(req, res)
      if (res.headersSent) return res
      const endTime = Date.now()
      return res.status(response.status).json({
        result: response.result,
        traceId,
        time: endTime - initTime,
      })
    } catch (error) {
      if (res.headersSent) return res
      if (error instanceof BitrixError) {
        return res.status(400).json({
          error: error.message,
          traceId,
          time: Date.now() - initTime,
        })
      } else {
        console.error('[Controller] Unexpected error:', { traceId, error })
        return res.status(500).json({
          error: 'Internal server error',
          traceId,
          time: Date.now() - initTime,
        })
      }
    }
  }
}
