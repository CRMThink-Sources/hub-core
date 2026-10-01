import { Request, Response } from 'express'
import z from 'zod'
import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { validateImbotIframeAuth } from '@/modules/audio/application/validate-imbot-iframe-auth'
import { encodeButtonActionCode } from '@/modules/thinkzap/application/parse-button-action-code'
import { apiLogger } from '@/shared/infra/logger'
import {
  logThinkzapError,
  THINKZAP_ERRORS,
} from '@/modules/thinkzap/errors/catalog'

export type CreateBitrixClientWithUserToken = (
  domain: string,
  accessToken: string,
) => Pick<BitrixClient, 'callMethod'>

export type ResolveOperatorBitrixAccessToken = (
  domain: string,
  bitrixUserId: string,
) => Promise<string | null>

export function createBitrixClientWithUserToken(
  domain: string,
  accessToken: string,
): Pick<BitrixClient, 'callMethod'> {
  return BitrixClient.withUserToken(domain, accessToken)
}

export const NEED_OPERATOR_OAUTH = 'NEED_OPERATOR_OAUTH'

const buttonSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('REPLY'),
  }),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('URL'),
    url: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('CALL'),
    phone: z.string().min(1),
  }),
])

// Exatamente um: `accessToken` ou auth do iframe imbot.
const sendButtonRequestSchema = z
  .object({
    dialogId: z.string(),
    userId: z.string().optional(),
    domain: z.string().min(1),
    accessToken: z.string().min(1).optional(),
    userHash: z.string().min(1).optional(),
    domainHash: z.string().min(1).optional(),
    body: z.string().min(1),
    header: z.string().optional(),
    footer: z.string().optional(),
    buttons: z.array(buttonSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const hasAccessToken = Boolean(data.accessToken)
    const hasIframeAuth = Boolean(
      data.userId && data.userHash && data.domainHash,
    )

    if (hasAccessToken === hasIframeAuth) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Informe accessToken ou userId/userHash/domainHash do iframe imbot.',
      })
    }
  })

// Botão não é tipo nativo do Bitrix: posta o código codificado como o operador, e
// `processBitrixReceivedMessage` o detecta no ONIMCONNECTORMESSAGEADD e envia pelo provider.
export class SendOpenChannelButtonController extends Controller {
  constructor(
    private readonly getDomainRepository: GetDomainRepository,
    private readonly createClient: CreateBitrixClientWithUserToken = createBitrixClientWithUserToken,
    private readonly resolveOperatorAccessToken: ResolveOperatorBitrixAccessToken,
    private readonly iframeHash: string = env.bitrix.iframeAudio.hash,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const params = sendButtonRequestSchema.safeParse(req.body)

    if (!params.success) {
      apiLogger.warn(
        { app: 'thinkzap', validationError: params.error.message },
        'open-channel-button: requisicao invalida',
      )
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const {
      dialogId,
      userId,
      domain,
      accessToken,
      userHash,
      domainHash,
      body,
      header,
      footer,
      buttons,
    } = params.data

    const parsedDomain = domain.replace(/^https?:\/\//, '').split('/')[0] ?? ''
    const usesIframeAuth = Boolean(userHash && domainHash && userId)

    if (usesIframeAuth) {
      const isValid = validateImbotIframeAuth({
        domain,
        userId: userId!,
        userHash: userHash!,
        domainHash: domainHash!,
        hash: this.iframeHash,
      })

      if (!isValid) {
        apiLogger.warn(
          { app: 'thinkzap', domain: parsedDomain, dialogId, userId },
          'open-channel-button: hash imbot invalido',
        )
        return { status: 401, result: { error: 'Invalid iframe auth' } }
      }
    }

    const domainEntity = await this.getDomainRepository.getDomain(parsedDomain)
    if (!domainEntity) {
      apiLogger.warn(
        { app: 'thinkzap', domain: parsedDomain, dialogId },
        'open-channel-button: domain nao encontrado',
      )
      return this.notFound(new Error('Domain not found'))
    }

    let operatorToken = accessToken ?? null
    if (usesIframeAuth) {
      operatorToken = await this.resolveOperatorAccessToken(
        parsedDomain,
        userId!,
      )

      if (!operatorToken) {
        apiLogger.warn(
          { app: 'thinkzap', domain: parsedDomain, dialogId, userId },
          'open-channel-button: token do operador ausente',
        )
        return {
          status: 401,
          result: {
            code: NEED_OPERATOR_OAUTH,
            error:
              'Operator OAuth required. Authorize ThinkZap once in the app menu.',
          },
        }
      }
    }

    const bitrix = this.createClient(parsedDomain, operatorToken!)
    const code = encodeButtonActionCode({ body, header, footer, buttons })

    try {
      await bitrix.callMethod('im.message.add', {
        DIALOG_ID: dialogId,
        MESSAGE: code,
      })
    } catch (error) {
      // Relançado, `BitrixError` vira 400 sem log no funil.
      logThinkzapError(
        apiLogger,
        'thinkzap.message.button_action_post_failed',
        {
          app: 'thinkzap',
          domain: parsedDomain,
          dialogId,
          phase: 'im.message.add',
          err: error,
        },
        { level: 'error' },
      )
      return this.badGateway(
        new Error(
          THINKZAP_ERRORS['thinkzap.message.button_action_post_failed']
            .userCause,
        ),
      )
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        domain: parsedDomain,
        dialogId,
        buttonCount: buttons.length,
      },
      'open-channel-button: código postado com sucesso',
    )

    return this.ok({
      message: 'Button action queued successfully',
      domain: parsedDomain,
      dialogId,
    })
  }
}
