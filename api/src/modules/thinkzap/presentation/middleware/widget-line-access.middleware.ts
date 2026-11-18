import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { WidgetLineAccess } from '@/modules/thinkzap/application/access-group/widget-line-access'
import { LineNotAllowedError } from '@/modules/thinkzap/domain/errors/line-not-allowed.error'

function readItemId(req: Request): string | undefined {
  const fromParams = req.params?.subscriptionItemId
  if (typeof fromParams === 'string' && fromParams) return fromParams
  const fromBody = (req.body as { subscriptionItemId?: unknown } | undefined)
    ?.subscriptionItemId
  return typeof fromBody === 'string' && fromBody ? fromBody : undefined
}

/**
 * Impõe os grupos de acesso nas rotas do **widget** que recebem uma linha
 * (`subscriptionItemId` na rota ou no corpo).
 *
 * É middleware de rota, e não checagem nos casos de uso, de propósito: robôs de
 * Bizproc, SMS e campanhas reutilizam esses casos de uso sem usuário de widget, e a
 * regra de grupos não vale para eles. Nas rotas multipart, fica depois do parser do
 * arquivo (é ele quem preenche `req.body`).
 *
 * Sem `subscriptionItemId` legível, deixa passar: a validação do corpo é do
 * controller, que responde o `400` de sempre.
 */
export function makeWidgetLineAccessMiddleware(
  access: WidgetLineAccess,
): RequestHandler {
  return async function widgetLineAccessMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const subscriptionItemId = readItemId(req)
    const { appId, domainId, bitrixUserId } = req
    if (!subscriptionItemId || !appId || !domainId || !bitrixUserId) {
      next()
      return
    }

    try {
      await access.assertCanUse({
        appCode: appId,
        domainId,
        bitrixUserId,
        subscriptionItemId,
      })
      next()
    } catch (error) {
      if (error instanceof LineNotAllowedError) {
        res.status(403).json({
          result: { error: error.message, code: 'line-not-allowed' },
        })
        return
      }
      next(error)
    }
  }
}
