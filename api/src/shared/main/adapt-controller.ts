import { Request, Response } from 'express'
import { Controller } from '../presentation/controller'
import { ZodError } from 'zod'

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
        console.log('Resposta já enviada')
        return
      }

      const err = error instanceof Error ? error : new Error(String(error))

      // Tratamento para erros de validação (400)
      if (error instanceof ZodError) {
        console.log('Validation Error: ' + error?.message)
        response.status(400).json({
          data: {
            error: error?.message,
          },
        })
        return
      }

      // Tratamento para erros genéricos (500)
      console.log('Erro não tratado no AdaptControllerFactory: ' + err.message)

      response.status(500).json({
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV !== 'production' ? err?.message : undefined,
      })
    }
  }
}
