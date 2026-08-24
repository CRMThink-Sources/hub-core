import {
  bufferToDataUrl,
  guessMimeTypeFromFileName,
  SendWidgetMessageUseCase,
} from '@/modules/thinkzap/application/send-widget-message.use-case'
import {
  WidgetAttachmentKind,
  WidgetMessageAttachmentInput,
} from '@/modules/thinkzap/application/send-widget-message.types'
import { mapWidgetSendError } from '@/modules/thinkzap/presentation/helpers/handle-widget-send-error'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

const attachmentMetaSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'file']),
  name: z.string().optional(),
})

const multipartBodySchema = z.object({
  subscriptionItemId: z.string().min(1),
  destination: z.string().min(1),
  message: z.string().optional(),
  entity: z.string().min(1),
  entityId: z.string().min(1),
  attachmentsMeta: z.string().min(1),
})

export class SendWidgetMessageMultipartController extends Controller {
  constructor(private readonly sendWidgetMessage: SendWidgetMessageUseCase) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsedBody = multipartBodySchema.safeParse(req.body)

    if (!parsedBody.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsedBody.error.message),
      )
    }

    const files = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : []

    if (!files.length) {
      return this.badRequest(
        new Error('At least one file attachment is required'),
      )
    }

    let attachmentsMeta: z.infer<typeof attachmentMetaSchema>[]
    try {
      const rawMeta = JSON.parse(parsedBody.data.attachmentsMeta) as unknown
      const parsedMeta = z.array(attachmentMetaSchema).safeParse(rawMeta)
      if (!parsedMeta.success) {
        return this.badRequest(
          new Error('Invalid attachmentsMeta: ' + parsedMeta.error.message),
        )
      }
      attachmentsMeta = parsedMeta.data
    } catch {
      return this.badRequest(new Error('Invalid attachmentsMeta JSON'))
    }

    if (attachmentsMeta.length !== files.length) {
      return this.badRequest(
        new Error('attachmentsMeta length must match uploaded files count'),
      )
    }

    const attachments: WidgetMessageAttachmentInput[] = await Promise.all(
      files.map(async (file, index) => {
        const meta = attachmentsMeta[index]
        if (!meta) {
          throw new Error('Missing attachment metadata for uploaded file')
        }

        const mimeType =
          file.mimetype || guessMimeTypeFromFileName(file.originalname)

        if (meta.kind === 'audio') {
          const mp3DataUrl =
            await this.sendWidgetMessage.convertAudioBufferToMp3DataUrl(
              file.buffer,
            )
          return {
            kind: 'audio' as WidgetAttachmentKind,
            content: mp3DataUrl,
            name: meta.name ?? file.originalname,
          }
        }

        return {
          kind: meta.kind,
          content: bufferToDataUrl(file.buffer, mimeType),
          name: meta.name ?? file.originalname,
        }
      }),
    )

    const trimmedMessage = parsedBody.data.message?.trim()

    try {
      const result = await this.sendWidgetMessage.execute({
        subscriptionItemId: parsedBody.data.subscriptionItemId,
        domainId: (req as unknown as { domainId: string }).domainId,
        appCode: (req as unknown as { appId: string }).appId,
        destination: parsedBody.data.destination,
        message: trimmedMessage || undefined,
        attachments,
        entity: parsedBody.data.entity,
        entityId: parsedBody.data.entityId,
        /**
         * Do token, nunca do corpo: aceitar do cliente deixaria um envio assinar com
         * o nome de outro operador. Aqui a entrega é síncrona, então este id é usado
         * na hora, não guardado.
         */
        operatorBitrixUserId: req.bitrixUserId,
      })
      return this.ok(result)
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_failed',
        { app: 'thinkzap', err: error },
        { level: 'error' },
      )
      return mapWidgetSendError(error)
    }
  }
}
