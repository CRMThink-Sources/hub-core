import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import {
  CreateConnectorTemplateUseCase,
  InvalidTemplateError,
  InvalidTemplateHeaderImageError,
} from '@/modules/thinkzap/application/create-connector-template'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { handleTemplateError } from './list-templates.controller'
import { parseLineRequest } from '../line/line-request'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

const componentSchema = z
  .object({
    type: z.enum(['BODY', 'FOOTER']),
    text: z.string().optional(),
  })
  .passthrough()

/**
 * Cabeçalho: só imagem, no formato neutro. `example.imageUrl` falta quando a imagem
 * vem como arquivo (multipart). As regras (uma fonte só, https, CDN da Meta,
 * categoria) ficam em `validateTemplateHeader`, no use case.
 */
const headerSchema = z.object({
  type: z.literal('HEADER'),
  format: z.literal('IMAGE'),
  example: z.object({ imageUrl: z.string() }).optional(),
})

/**
 * Forma de cada tipo de botão. Os limites (quantidade, tamanho, categoria) ficam em
 * `validateTemplateButtons`, no use case — aqui só o formato do pedido.
 */
const buttonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: z.string() }),
  z.object({
    type: z.literal('URL'),
    text: z.string(),
    url: z.string(),
    example: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('PHONE_NUMBER'),
    text: z.string(),
    phone_number: z.string(),
  }),
  z.object({ type: z.literal('COPY_CODE'), example: z.string() }),
])

const buttonsComponentSchema = z.object({
  type: z.literal('BUTTONS'),
  buttons: z.array(buttonSchema).min(1),
})

const bodySchema = z.object({
  name: z.string().min(1),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  language: z.string().min(1),
  components: z
    .array(z.union([buttonsComponentSchema, headerSchema, componentSchema]))
    .min(1),
})

/**
 * Recusas da Meta à imagem de exemplo, que chegam cruas no corpo do erro:
 * `2388215` (amostra inválida — típico de link do CDN da própria Meta) e `380`
 * (a Meta não conseguiu baixar o link). O formato exato do corpo da Omni não é
 * documentado, então procuramos o código no JSON inteiro.
 */
export function headerImageRejectionMessage(body: unknown): string | null {
  const raw = JSON.stringify(body ?? '')
  if (/\b2388215\b/.test(raw)) {
    return 'A Meta recusou a imagem de exemplo do cabeçalho. Use o link de um arquivo JPEG ou PNG hospedado fora do WhatsApp/Meta.'
  }
  if (/"(code|error_subcode|errorCode)"\s*:\s*"?380\b/.test(raw)) {
    return 'A Meta não conseguiu baixar a imagem de exemplo do cabeçalho. Confira se o link é público e aponta direto para o arquivo.'
  }
  return null
}

const MISSING_APP_CREDENTIALS_MESSAGE =
  'O envio de arquivo da imagem não está disponível nesta conta do WhatsApp Oficial (faltam as credenciais do app da Meta no painel da Z-API Omni). Use um link público da imagem.'

/**
 * Upload da imagem recusado pela Omni porque a conta não tem App ID/App Secret da
 * Meta cadastrados (`422 MISSING_APP_CREDENTIALS`). O código vem no corpo; o
 * formato exato não é documentado, então procuramos no JSON inteiro.
 */
export function isMissingAppCredentials(error: HubMessageApiError): boolean {
  return (
    error.status === 422 &&
    JSON.stringify(error.body ?? '').includes('MISSING_APP_CREDENTIALS')
  )
}

const MEDIA_ROUTE_UNAVAILABLE_MESSAGE =
  'O envio de arquivo da imagem não está disponível no momento. Use um link público da imagem.'

/**
 * Rota de upload da Omni (`templates/media`) inexistente no servidor: documentada,
 * mas respondendo `405`/`404` (constatado em 2026-10-20). Só é chamada em ambiente
 * sem o bucket R2.
 */
export function isTemplateMediaRouteUnavailable(
  error: HubMessageApiError,
): boolean {
  return (
    (error.status === 404 || error.status === 405) &&
    error.url.endsWith('/templates/media')
  )
}

/**
 * Corpo do pedido nos dois formatos: JSON direto, ou multipart com o JSON em
 * `payload` (o multer entrega campos de texto como string) e o arquivo à parte.
 */
function requestBody(req: Request): unknown {
  const body = req.body as Record<string, unknown> | undefined
  if (typeof body?.payload !== 'string') return body

  try {
    return JSON.parse(body.payload) as unknown
  } catch {
    return new Error('Invalid request: payload is not valid JSON')
  }
}

/** `POST /thinkzap/lines/:itemId/templates` — cadastra template da linha. */
export class CreateTemplateController extends Controller {
  constructor(private readonly useCase: CreateConnectorTemplateUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const raw = requestBody(req)
    if (raw instanceof Error) return this.badRequest(raw)

    const body = bodySchema.safeParse(raw)
    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      const created = await this.useCase.execute({
        ...parseLineRequest(req),
        name: body.data.name,
        category: body.data.category,
        language: body.data.language,
        components: body.data.components,
        ...(req.file ? { headerImageFile: { data: req.file.buffer } } : {}),
      })
      return this.ok({ template: created })
    } catch (error) {
      if (error instanceof InvalidTemplateHeaderImageError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.template.header_image_invalid',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(error)
      }
      if (error instanceof InvalidTemplateError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.template.invalid_definition',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(error)
      }
      // Bucket fora do ar: nada foi enviado à Meta, e o link continua funcionando.
      if (error instanceof TemplateImageStorageUnavailableError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.message.widget_header_image_storage_unavailable',
          { app: 'thinkzap', err: error, detail: error.detail },
          { level: 'error' },
        )
        return {
          status: 503,
          result: {
            error: error.message,
            code: 'header-image-upload-unavailable',
          },
        }
      }
      // Rejeição de negócio da Meta: propaga a mensagem legível sem mascarar.
      if (error instanceof HubMessageApiError) {
        if (isMissingAppCredentials(error)) {
          logThinkzapError(
            apiLogger,
            'thinkzap.template.header_image_app_credentials_missing',
            { app: 'thinkzap', err: error },
            { level: 'warn' },
          )
          return this.badRequest(new Error(MISSING_APP_CREDENTIALS_MESSAGE))
        }
        if (isTemplateMediaRouteUnavailable(error)) {
          logThinkzapError(
            apiLogger,
            'thinkzap.template.provider_rejected',
            { app: 'thinkzap', err: error, reason: 'media-route-unavailable' },
            { level: 'warn' },
          )
          return this.badRequest(new Error(MEDIA_ROUTE_UNAVAILABLE_MESSAGE))
        }
        const imageRejection = headerImageRejectionMessage(error.body)
        if (imageRejection) {
          logThinkzapError(
            apiLogger,
            'thinkzap.template.header_image_invalid',
            { app: 'thinkzap', err: error },
            { level: 'warn' },
          )
          return this.badRequest(new Error(imageRejection))
        }
        logThinkzapError(
          apiLogger,
          'thinkzap.template.provider_rejected',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(new Error(error.message))
      }
      return handleTemplateError.call(this, error)
    }
  }
}
