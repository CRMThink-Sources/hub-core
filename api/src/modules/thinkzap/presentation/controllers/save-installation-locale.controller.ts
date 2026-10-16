import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { NOTICE_LOCALES } from '@/modules/thinkzap/domain/daily-limit-notices'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'

const bodySchema = z.object({ locale: z.enum(NOTICE_LOCALES) }).strict()

const installationSchema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `PUT /api/thinkzap/locale` — grava o idioma escolhido no app para a instalação.
 *
 * É o que o servidor usa nos avisos que gera sem tela aberta (limite diário no chat do
 * canal aberto e na timeline). A instalação vem do JWT, nunca do corpo: quem chama não
 * escolhe o escopo. A última escolha explícita vale para a instalação inteira.
 */
export class SaveInstallationLocaleController extends Controller {
  constructor(private readonly locales: InstallationLocaleRepository) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const body = bodySchema.safeParse(req.body)
    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    const installation = installationSchema.parse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    const saved = await this.locales.save(
      installation.domainId,
      installation.appCode,
      body.data.locale,
    )
    if (!saved) {
      return this.notFound(new Error('Installation not found'))
    }

    return this.ok({ locale: body.data.locale })
  }
}
