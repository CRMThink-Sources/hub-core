import { Request, Response } from 'express'
import { ZodError } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { randomUUID } from 'crypto'
import { BitrixError } from '../infra/clients/errors/bitrix-client.error'
import { apiLogger } from '@/shared/infra/logger'
import { AppError } from '@/shared/domain/errors/app-error'
import { appErrorLogFields } from '@/shared/infra/log-error'

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

  /**
   * Falha de um terceiro que a requisição não pode corrigir — provider que respondeu
   * sem o dado que a operação exige, por exemplo.
   *
   * Existe para não cair no `500` genérico do `handle`, que registra "erro inesperado"
   * e responde `Internal server error`: as duas coisas mentem quando o erro é
   * esperado, nomeado, e diz exatamente o que faltou.
   */
  protected badGateway(error: Error): httpResponse {
    return { status: 502, result: { error: error.message } }
  }

  protected ok(data: unknown): httpResponse {
    return { status: 200, result: data }
  }

  /**
   * Aceito, ainda não concluído.
   *
   * Para as operações que ficam duráveis no request e são executadas depois — o envio
   * pelo widget é a primeira. Responder `200` nesses casos afirmaria uma conclusão que
   * não aconteceu, e o cliente não teria como distinguir "feito" de "aceito".
   */
  protected accepted(data: unknown): httpResponse {
    return { status: 202, result: data }
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
      // Zod = validação de payload → 400 (antes caía no genérico → 500).
      if (error instanceof ZodError) {
        apiLogger.warn({ err: error, traceId }, 'Erro de validação no request')
        return res.status(400).json({
          result: { error: error.issues[0]?.message ?? 'Dados inválidos' },
          traceId,
          time: Date.now() - initTime,
        })
      }
      // AppError: errorCode no log (casa com runbook), shape de resposta preservado.
      if (error instanceof AppError) {
        // <500 = erro do cliente → warn (não polui dashboard); >=500 = falha nossa.
        const level = error.httpStatus >= 500 ? 'error' : 'warn'
        apiLogger[level](appErrorLogFields(error, { traceId }), error.userCause)
        return res.status(error.httpStatus).json({
          result: { error: error.userCause },
          traceId,
          time: Date.now() - initTime,
        })
      }
      if (error instanceof BitrixError) {
        return res.status(400).json({
          error: error.message,
          traceId,
          time: Date.now() - initTime,
        })
      } else {
        apiLogger.error(
          { err: error, errorCode: 'UNCLASSIFIED', traceId },
          'Erro inesperado no controller',
        )
        return res.status(500).json({
          error: 'Internal server error',
          traceId,
          time: Date.now() - initTime,
        })
      }
    }
  }
}
