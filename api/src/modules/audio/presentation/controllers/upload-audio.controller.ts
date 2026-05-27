import { env } from '@/config/env'

import {
  convertRecordedAudioToMp3,
  type ConvertedRecordedAudio,
} from '@/modules/audio/application/convert-recorded-audio-to-mp3'
import { validateImbotIframeAuth } from '@/modules/audio/application/validate-imbot-iframe-auth'

import { httpResponse } from '@/shared/helpers/http'

import {
  BitrixDiskClient,
  type ImV2FileUploadResult,
} from '@/shared/infra/clients/bitrix-disk'

import { apiLogger } from '@/shared/infra/logger'

import { Controller } from '@/shared/presentation/controller'

import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'

import type { Request, Response } from 'express'

import z from 'zod'

export type CreateBitrixDiskClient = (
  domain: string,

  accessToken: string,
) => Pick<BitrixDiskClient, 'uploadFileToChat'>

export type ResolveOperatorBitrixAccessToken = (
  domain: string,

  bitrixUserId: string,
) => Promise<string | null>

export type ConvertRecordedAudio = (
  inputBuffer: Buffer,
  originalFileName?: string,
) => Promise<ConvertedRecordedAudio>

export function createBitrixDiskClientWithUserToken(
  domain: string,

  accessToken: string,
): Pick<BitrixDiskClient, 'uploadFileToChat'> {
  return BitrixDiskClient.withUserToken(domain, accessToken)
}

export const NEED_OPERATOR_OAUTH = 'NEED_OPERATOR_OAUTH'

const uploadRequestSchema = z

  .object({
    dialogId: z.string(),

    userId: z.string().optional(),

    domain: z.string().min(1),

    accessToken: z.string().min(1).optional(),

    userHash: z.string().min(1).optional(),

    domainHash: z.string().min(1).optional(),
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

export class UploadAudioController extends Controller {
  constructor(
    private readonly getDomainRepository: GetDomainRepository,

    private readonly createDiskClient: CreateBitrixDiskClient = createBitrixDiskClientWithUserToken,

    private readonly resolveOperatorAccessToken: ResolveOperatorBitrixAccessToken,

    private readonly iframeHash: string = env.bitrix.iframeAudio.hash,

    private readonly convertRecordedAudio: ConvertRecordedAudio = convertRecordedAudioToMp3,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const params = uploadRequestSchema.safeParse(req.body)

    if (!params.success) {
      apiLogger.warn(
        { app: 'thinkzap', validationError: params.error.message },

        'audio-upload: requisicao invalida',
      )

      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { dialogId, userId, domain, accessToken, userHash, domainHash } =
      params.data

    const parsedDomain = domain.replace(/^https?:\/\//, '').split('/')[0] ?? ''

    const startedAt = Date.now()

    const usesIframeAuth = Boolean(userHash && domainHash && userId)

    const audio = req.file

    if (!audio?.buffer?.length) {
      apiLogger.warn(
        { app: 'thinkzap', domain, dialogId },

        'audio-upload: audio nao encontrado',
      )

      return this.badRequest(new Error('Audio not found'))
    }

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

          'audio-upload: hash imbot invalido',
        )

        return {
          status: 401,

          result: { error: 'Invalid iframe auth' },
        }
      }
    }

    const domainEntity = await this.getDomainRepository.getDomain(parsedDomain)

    if (!domainEntity) {
      apiLogger.warn(
        { app: 'thinkzap', domain: parsedDomain, dialogId },

        'audio-upload: domain nao encontrado',
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

          'audio-upload: token do operador ausente',
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

    const bitrix = this.createDiskClient(parsedDomain, operatorToken!)

    let mp3Audio: ConvertedRecordedAudio

    try {
      mp3Audio = await this.convertRecordedAudio(
        audio.buffer,
        audio.originalname,
      )
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',

          domain: parsedDomain,

          dialogId,

          phase: 'audio.convert-to-mp3',

          err: error,
        },

        'audio-upload: falha na conversao para mp3',
      )

      throw error
    }

    const mp3Base64 = mp3Audio.buffer.toString('base64')

    apiLogger.info(
      {
        app: 'thinkzap',

        domain: parsedDomain,

        dialogId,

        userId,

        authMode: usesIframeAuth ? 'imbot-iframe' : 'access-token',

        fileName: audio.originalname,

        fileSizeBytes: audio.buffer.length,

        mimeType: audio.mimetype,

        mp3FileName: mp3Audio.fileName,

        mp3FileSizeBytes: mp3Audio.buffer.length,

        mp3MimeType: 'audio/mpeg',
      },

      'audio-upload: iniciando upload mp3',
    )

    let uploadResult: ImV2FileUploadResult

    try {
      uploadResult = await bitrix.uploadFileToChat({
        dialogId,

        fileName: mp3Audio.fileName,

        base64: mp3Base64,

        message: '',
      })
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',

          domain: parsedDomain,

          dialogId,

          phase: 'im.v2.File.upload',

          err: error,
        },

        'audio-upload: falha',
      )

      throw error
    }

    apiLogger.info(
      {
        app: 'thinkzap',

        domain: parsedDomain,

        dialogId,

        messageId: uploadResult.messageId,

        fileId: uploadResult.file.id,

        durationMs: Date.now() - startedAt,
      },

      'audio-upload: concluido com sucesso',
    )

    return this.ok({
      message: 'Audio uploaded successfully',

      domain: parsedDomain,

      dialogId,

      userId,

      messageId: uploadResult.messageId,

      fileId: uploadResult.file.id,
    })
  }
}
