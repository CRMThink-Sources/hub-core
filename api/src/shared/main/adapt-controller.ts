import { Request, Response } from "express";
import { Controller } from "../presentation/controller";

type ControllerHandler = (req: Request, res: Response) => Promise<void> | void;
type ControllerFactoryWithReq = (req: Request) => Promise<Controller> | Controller;

export const adaptControllerFactory = (factory: ControllerFactoryWithReq): ControllerHandler => {
  return async (request: Request, response: Response) => {
    try {
      // Criar o controller usando a factory com o request
      const controller = await factory(request);

      // Executar o controller
      await controller.handle(request, response);
    } catch (error: any) {
      // Verificar se a resposta já foi enviada
      if (response.headersSent) {
        console.log("Resposta já enviada");
        return;
      }

      // Tratamento para erros de validação (400)
      if (error?.name === 'ZodError' || error?.issues) {
        console.log("Validation Error: " + error.message);
        response.status(400).json({
          data: {
            error: error.message,
          },
        });
        return;
      }

      // Tratamento para erros genéricos (500)
      console.log("Erro não tratado no AdaptControllerFactory: " + error.message);

      response.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV !== 'production' ? error?.message : undefined,
      });
    }
  };
}