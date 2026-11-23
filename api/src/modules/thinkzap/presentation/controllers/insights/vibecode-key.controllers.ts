import { Request, Response } from 'express'
import { z } from 'zod'
import type { GetInsightsStatus } from '@/modules/thinkzap/application/insights/get-insights-status'
import type { RemoveVibecodeKey } from '@/modules/thinkzap/application/insights/remove-vibecode-key'
import type { SaveVibecodeKey } from '@/modules/thinkzap/application/insights/save-vibecode-key'
import { VibecodeKeyRejectedError } from '@/modules/thinkzap/domain/errors/vibecode-key-rejected.error'
import {
  VibecodeAuthError,
  VibecodeRequestError,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

const keyBodySchema = z.object({
  key: z
    .string({ error: 'Informe a chave Vibecode.' })
    .trim()
    .min(1, 'Informe a chave Vibecode.'),
})

/**
 * Nenhuma resposta ou log daqui carrega a chave: as mensagens de erro vêm do
 * domínio/cliente, que já as constroem sem ela.
 */
export class SaveVibecodeKeyController extends Controller {
  constructor(private readonly save: Pick<SaveVibecodeKey, 'execute'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))

    const parsed = keyBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return this.badRequest(
        new Error(
          parsed.error.issues[0]?.message ?? 'Informe a chave Vibecode.',
        ),
      )
    }

    try {
      return this.ok(await this.save.execute(appId, parsed.data.key))
    } catch (error) {
      if (error instanceof VibecodeKeyRejectedError) {
        return this.unprocessableEntity(error)
      }
      // A mensagem do cliente fala em "permissão"; aqui o admin só precisa
      // saber que a chave em si não serve.
      if (error instanceof VibecodeAuthError) {
        return this.unprocessableEntity(
          new Error(
            'A Vibecode recusou esta chave. Confira se ela está correta e ativa.',
          ),
        )
      }
      // 5xx/rede ao chamar /me: instabilidade da Vibecode, não da chave. A
      // mensagem do cliente não é repassada (nunca carrega a chave, mas o texto
      // é interno); o admin só precisa tentar de novo.
      if (error instanceof VibecodeRequestError) {
        return this.badGateway(
          new Error(
            'Não foi possível falar com a Vibecode agora. Tente de novo em instantes.',
          ),
        )
      }
      throw error
    }
  }
}

export class RemoveVibecodeKeyController extends Controller {
  constructor(private readonly remove: Pick<RemoveVibecodeKey, 'execute'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))
    await this.remove.execute(appId)
    return { status: 204, result: null }
  }
}

export class GetInsightsStatusController extends Controller {
  constructor(private readonly status: Pick<GetInsightsStatus, 'execute'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))
    // Mesmo sinal do `requireThinkzapAdmin`: só quem administra vê last4/data.
    const includeKeyDetails = Boolean(req.thinkzapAccess?.canManageAccess)
    return this.ok(await this.status.execute(appId, { includeKeyDetails }))
  }
}
