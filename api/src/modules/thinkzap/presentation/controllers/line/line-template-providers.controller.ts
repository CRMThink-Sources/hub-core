import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  DeleteTemplateSmsProvider,
  GetLineTemplateProviders,
  RegisterTemplateSmsProvider,
  type ListTemplatesForLine,
} from '@/modules/thinkzap/application/manage-line-sms-provider'
import { TemplateNotInCatalogError } from '@/modules/thinkzap/domain/errors/template-not-in-catalog.error'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * Nome e idioma vêm do corpo, não da URL: o nome do template é do cliente e pode
 * conter o que a Meta permitir, e enfiá-lo num segmento de path obrigaria a
 * codificação em toda chamada — com o `.` do separador de `CODE` no meio.
 */
const bodySchema = z
  .object({
    templateName: z.string().min(1),
    language: z.string().min(1),
  })
  .strict()

/** Template não aprovado é `422`: o pedido é válido, o catálogo é que não tem. */
function mapTemplateError(error: unknown, fallback: string): httpResponse {
  if (error instanceof TemplateNotInCatalogError) {
    return { status: 422, result: { error: error.message } }
  }

  return mapLineError(error, fallback)
}

/**
 * `GET /api/thinkzap/lines/:itemId/sms-templates` — o catálogo aprovado da linha
 * oficial, cada template com o estado do provedor de campanha.
 */
export class GetLineTemplateProvidersController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly listTemplates: ListTemplatesForLine,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      return this.ok(
        await new GetLineTemplateProviders(
          this.getAplicationContext,
          this.listTemplates,
        ).execute(input, this.bitrixClient),
      )
    } catch (error) {
      return mapTemplateError(
        error,
        'Falha ao ler os templates da linha para campanha',
      )
    }
  }
}

/** `POST .../sms-templates` — oferece um template na campanha de SMS do cliente. */
export class RegisterTemplateSmsProviderController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly listTemplates: ListTemplatesForLine,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)
    const body = bodySchema.safeParse(req.body)

    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      return this.ok(
        await new RegisterTemplateSmsProvider(
          this.getAplicationContext,
          this.listTemplates,
        ).execute(input, body.data, this.bitrixClient),
      )
    } catch (error) {
      return mapTemplateError(error, 'Falha ao oferecer o template na campanha')
    }
  }
}

/** `DELETE .../sms-templates` — tira o template da lista de provedores. */
export class DeleteTemplateSmsProviderController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)
    const body = bodySchema.safeParse(req.body)

    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      return this.ok(
        await new DeleteTemplateSmsProvider(this.getAplicationContext).execute(
          input,
          body.data,
          this.bitrixClient,
        ),
      )
    } catch (error) {
      return mapTemplateError(error, 'Falha ao remover o template da campanha')
    }
  }
}
