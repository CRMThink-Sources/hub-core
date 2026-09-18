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

/**
 * Mesmo par de auth do upload de áudio: `accessToken` direto, ou
 * `userId`/`userHash`/`domainHash` do iframe imbot — nunca os dois, nunca
 * nenhum.
 */
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

/**
 * `POST /api/open-channel-button/send` — a tela de botões do widget do
 * canal aberto. Mirror de `UploadAudioController`: mesma autenticação
 * (accessToken direto ou iframe imbot), mesma resolução de domínio e de
 * token do operador.
 *
 * **O que diverge do áudio, e por quê.** Áudio faz upload de arquivo
 * (`im.v2.File.upload`) porque arquivo é tipo nativo do Bitrix — a mensagem
 * cai no canal aberto e o próprio `ONIMCONNECTORMESSAGEADD` a repassa ao
 * provider como sempre repassou. **Botão não é tipo nativo** — não existe
 * forma de o Bitrix saber que aquele texto deveria virar botão do WhatsApp.
 *
 * A saída: este controller posta, **como o operador** (`im.message.add`,
 * com o token dele — não o bot), o código de `parse-button-action-code.ts`
 * no lugar de um texto comum. Isso dispara o mesmo `ONIMCONNECTORMESSAGEADD`
 * de qualquer resposta digitada, e é `processBitrixReceivedMessage` —
 * que já resolve provider e destino para toda mensagem de saída — quem
 * detecta o código antes de ele virar mensagem livre e chama o contrato
 * neutro de botões. Esta tela nunca precisa saber o provider da linha.
 */
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
      apiLogger.error(
        {
          app: 'thinkzap',
          domain: parsedDomain,
          dialogId,
          phase: 'im.message.add',
          err: error,
        },
        'open-channel-button: falha ao postar o código no canal aberto',
      )
      throw error
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
