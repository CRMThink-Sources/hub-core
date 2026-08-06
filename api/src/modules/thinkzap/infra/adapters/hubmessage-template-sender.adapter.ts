import { TemplateProviderUnavailableError } from '@/modules/thinkzap/domain/ports/template-errors'
import {
  TemplateMessageDescriptor,
  TemplateMessageSender,
  TemplateSendResult,
} from '@/modules/thinkzap/domain/ports/template-message-sender.port'
import { isProviderUnavailableError } from './is-provider-unavailable-error'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { SendHubMessageTemplateParams } from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('hubmessage')

export type HubMessageTemplateSenderConfig = {
  /** Canal da linha no provider (`metadata.hubmessageChannelId`). */
  channelId: string
  /** Telefone do destinatário, já normalizado pelo chamador. */
  recipientIdentifier: string
}

/**
 * Adapter HubMessage do contrato `TemplateMessageSender`.
 *
 * Diferente do envio livre (`HubMessageOutboundSender`), não há degradação de
 * capacidade aqui: template é recurso do WhatsApp Oficial e este provider o
 * suporta inteiro. O que o adapter faz é traduzir o descriptor neutro para o
 * payload do provider — e é só aqui que a ordem posicional dos parâmetros vira
 * formato de API.
 *
 * A recusa de negócio do provider (`4xx`) **não** é capturada: a mensagem dele diz o
 * motivo real — template inexistente, idioma divergente, número de parâmetros errado —
 * e é isso que o operador precisa ler. Engolir e relançar genérico deixaria "falha ao
 * enviar" na tela.
 *
 * Indisponibilidade (`5xx`, falha de rede) é o oposto e vira erro de domínio: o texto
 * do provider não descreve nada acionável. Ver `isProviderUnavailableError`.
 */
export class HubMessageTemplateSender implements TemplateMessageSender {
  readonly supportsTemplateSend = true

  constructor(
    private readonly client: HubMessageClient,
    private readonly config: HubMessageTemplateSenderConfig,
  ) {}

  async send(
    descriptor: TemplateMessageDescriptor,
  ): Promise<TemplateSendResult> {
    const { channelId, recipientIdentifier } = this.config

    const params: SendHubMessageTemplateParams = {
      recipient: { identifier: recipientIdentifier },
      content: {
        type: 'TEMPLATE',
        /**
         * O template vive dentro de `attachments`, não em `content.template` —
         * armadilha da API, ver `SendHubMessageTemplateParams`.
         */
        attachments: [
          {
            template: {
              name: descriptor.templateName,
              /**
               * `deterministic`: enviar neste idioma ou falhar. O fallback de idioma
               * da Meta escolheria outra versão aprovada do template, e o operador
               * mandaria um texto que não é o que ele viu no preview.
               */
              language: { policy: 'deterministic', code: descriptor.language },
              /**
               * Ordem preservada como recebida — é o contrato do port. Template sem
               * variável omite `components` em vez de mandar array vazio: o corpo já
               * está aprovado sem placeholder e não há o que parametrizar.
               */
              ...(descriptor.bodyParameters.length > 0
                ? {
                    components: [
                      {
                        type: 'BODY' as const,
                        parameters: descriptor.bodyParameters.map(text => ({
                          type: 'text' as const,
                          text,
                        })),
                      },
                    ],
                  }
                : {}),
            },
          },
        ],
      },
    }

    const { messageId } = await this.client
      .sendTemplateMessage(channelId, params)
      .catch((error: unknown) => {
        if (!isProviderUnavailableError(error)) throw error

        /**
         * A mensagem crua morre aqui, então é aqui que ela precisa ser registrada —
         * sem este log o diagnóstico do 502 sumiria junto com o texto.
         */
        log.error(
          {
            channelId,
            templateName: descriptor.templateName,
            err: error,
            providerUnavailable: true,
          },
          'HubMessage indisponível no envio de template',
        )

        throw new TemplateProviderUnavailableError(
          error instanceof Error ? error.message : String(error),
        )
      })

    log.info(
      {
        channelId,
        templateName: descriptor.templateName,
        language: descriptor.language,
        parameterCount: descriptor.bodyParameters.length,
        messageId,
      },
      'Template enviado pela HubMessage',
    )

    return { messageId }
  }
}
