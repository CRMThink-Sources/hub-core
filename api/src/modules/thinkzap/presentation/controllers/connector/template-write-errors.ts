import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import z from 'zod'

import {
  InvalidTemplateError,
  InvalidTemplateHeaderImageError,
} from '@/modules/thinkzap/application/helpers/template-definition'
import { TemplateNotEditableError } from '@/modules/thinkzap/application/update-connector-template'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { handleTemplateError } from './list-templates.controller'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

/**
 * O que criar, editar e definir imagem padrão de template têm em comum: o pedido
 * (JSON ou multipart) e a tradução dos erros de escrita para HTTP.
 */

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

/** Definição do template, na criação e na edição. */
export const templateBodySchema = z.object({
  name: z.string().min(1),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  language: z.string().min(1),
  components: z
    .array(z.union([buttonsComponentSchema, headerSchema, componentSchema]))
    .min(1),
})

/**
 * Corpo do pedido nos dois formatos: JSON direto, ou multipart com o JSON em
 * `payload` (o multer entrega campos de texto como string) e o arquivo à parte.
 */
export function requestBody(req: Request): unknown {
  const body = req.body as Record<string, unknown> | undefined
  if (typeof body?.payload !== 'string') return body

  try {
    return JSON.parse(body.payload) as unknown
  } catch {
    return new Error('Invalid request: payload is not valid JSON')
  }
}

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

const EDIT_LIMIT_MESSAGE =
  'Este template atingiu o limite de edições da Meta (uma por dia e até dez em 30 dias, para templates aprovados). Tente de novo mais tarde.'

const NOT_EDITABLE_MESSAGE =
  'A Meta não permite editar este template no estado atual. Templates em análise não podem ser editados.'

/**
 * Recusas da Meta à edição. Os códigos exatos ainda não foram confirmados na Omni
 * (tarefa 1.4), então reconhecemos pela mensagem: limite de edições e estado que
 * não permite editar.
 */
export function templateEditRejection(
  body: unknown,
): { code: 'edit_limit_reached' | 'not_editable'; message: string } | null {
  const raw = JSON.stringify(body ?? '').toLowerCase()
  if (!/edit/.test(raw)) return null
  if (/limit|24 hours|30 days|too many|maximum/.test(raw)) {
    return { code: 'edit_limit_reached', message: EDIT_LIMIT_MESSAGE }
  }
  if (/status|pending|not allowed|cannot|can't|not editable/.test(raw)) {
    return { code: 'not_editable', message: NOT_EDITABLE_MESSAGE }
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

/** Erros de escrita de template (criar, editar, imagem padrão) → HTTP. */
export function handleTemplateWriteError(
  this: Controller,
  error: unknown,
): httpResponse {
  if (error instanceof TemplateNotEditableError) {
    logThinkzapError(
      apiLogger,
      'thinkzap.template.not_editable',
      { app: 'thinkzap', err: error },
      { level: 'warn' },
    )
    return this.badRequest(error)
  }
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
    if (error.method === 'PUT') {
      const editRejection = templateEditRejection(error.body)
      if (editRejection) {
        logThinkzapError(
          apiLogger,
          editRejection.code === 'edit_limit_reached'
            ? 'thinkzap.template.edit_limit_reached'
            : 'thinkzap.template.not_editable',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(new Error(editRejection.message))
      }
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
