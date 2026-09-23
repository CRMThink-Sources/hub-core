import { Request } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  AppCodeNotFoundError,
  InstallApp,
  InstallStepError,
} from '@/shared/application/install-app'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'

/** Mesmos campos que o formulário de instalação já envia. Nada de contato novo. */
const installSchema = z.object({
  domain: z.string().min(1),
  member_id: z.string().min(1),
  app_code: z.string().min(1),
  email: z.string(),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number(),
})

/**
 * Valida o payload e delega. Toda a orquestração vive em `InstallApp` — este
 * controller não conhece passo, ordem, nem app específico.
 */
export class InstallController extends Controller {
  constructor(private readonly installApp: InstallApp) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = installSchema.safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const body = params.data
    const catalogEntry = resolveByMarketplaceCode(body.app_code)

    // Antes de qualquer escrita: `app_code` desconhecido não chega no caso de uso.
    if (!catalogEntry) {
      return this.notFound(new Error('App ID not found'))
    }

    const appCode = catalogEntry.appCodeId

    try {
      const result = await this.installApp.execute({
        domain: body.domain,
        memberId: body.member_id,
        appCode,
        email: body.email,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresIn: body.expires_in,
      })

      return this.ok({
        ...result.domain,
        app: result.app,
        spaItemId: result.spaItemId,
      })
    } catch (error) {
      if (error instanceof InstallStepError) return this.installFailed(error)
      throw error
    }
  }

  /**
   * O passo que quebrou vai no corpo: sem isso o frontend só consegue dizer
   * "falhou", e o suporte tem que abrir o log para saber onde.
   */
  private installFailed(error: InstallStepError): httpResponse {
    return {
      status: statusFor(error),
      result: { error: { step: error.step, message: error.message } },
    }
  }
}

function statusFor(error: InstallStepError): number {
  if (error.cause instanceof AppCodeNotFoundError) return 404

  // 502 quando a origem é o Bitrix — falha de terceiro, o cliente pode tentar de
  // novo. 500 quando é o banco.
  return error.isUpstream ? 502 : 500
}
