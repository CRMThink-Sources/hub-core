import { Router } from 'express'
import { adaptControllerFactory } from '@/shared/main/adapt-controller'
import { makeGetAplicationContextController } from './main/make-get-aplication-context-controller'

/**
 * Rotas do prefixo `/api/application`, montadas atrás do `authMiddleware` de app.
 *
 * O prefixo é `aplication` e não `payments` de propósito: o recurso devolvido é a
 * **instalação**, com o billing como um dos seus atributos. `payments` é o nome
 * da pasta do módulo — vocabulário interno, que pode mudar sem quebrar cliente.
 */
export const createAplicationRoutes = (): Router => {
  const router = Router()

  /**
   * Contexto de billing da instalação do token. Sem parâmetro de path: o par
   * (`domainId`, `appCodeId`) do JWT já é a chave única de `core_apps`, então um
   * id aqui seria redundante na melhor hipótese e um vetor de IDOR na pior.
   *
   * Só `GET`: esta superfície não escreve nada.
   */
  router.get('/me', adaptControllerFactory(makeGetAplicationContextController))

  return router
}
