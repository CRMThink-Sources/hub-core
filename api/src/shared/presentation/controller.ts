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

  protected notFound(error: Error): httpResponse {
    return { status: 404, result: { error: error.message } }
  }

  protected ok(data: unknown): httpResponse {
    return { status: 200, result: data }
  }

  async handle(req: Request, res: Response) {
    const initTime = Date.now()
    const traceId = randomUUID()
    try {
      const response = await this.perform(req, res)
      const endTime = Date.now()
      return res.status(response.status).json({
        result: response.result,
        traceId,
        time: endTime - initTime,
      })
    } catch (error) {
      if (error instanceof BitrixError) {
        console.error(error.message)
      }
      return res.status(500).json({
        error: 'Internal server error',
        traceId,
        time: Date.now() - initTime,
      })
    } finally {
      const endTime = Date.now()
      console.log(`${this.constructor.name} took ${endTime - initTime}ms`)
    }
  }
}
