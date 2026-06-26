import { Request, Response } from 'express'
import { Controller } from '../presentation/controller'
import { ZodError } from 'zod'
import { apiLogger } from '@/shared/infra/logger'

type ControllerHandler = (req: Request, res: Response) => Promise<void> | void
type ControllerFactoryWithReq = (
  req: Request,
) => Promise<Controller> | Controller

export const adaptControllerFactory = (
  factory: ControllerFactoryWithReq,
): ControllerHandler => {
  return async (request: Request, response: Response) => {
    try {
      // Criar o controller usando a factory com o request
      const controller = await factory(request)

      // Executar o controller
      await controller.handle(request, response)
    } catch (error: unknown) {
      // Verificar se a resposta já foi enviada
      if (response.headersSent) {
        apiLogger.warn('Resposta já enviada antes do tratamento de erro')
        return
      }

      const err = error instanceof Error ? error : new Error(String(error))

      // Tratamento para erros de validação (400)
      if (error instanceof ZodError) {
        apiLogger.warn({ err: error }, 'Erro de validação no request')
        response.status(400).json({
          data: {
            error: error?.message,
          },
        })
        return
      }

      // Tratamento para erros genéricos (500)
      apiLogger.error({ err }, 'Erro não tratado no adaptControllerFactory')

      response.status(500).json({
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV !== 'production' ? err?.message : undefined,
      })
    }
  }
}
