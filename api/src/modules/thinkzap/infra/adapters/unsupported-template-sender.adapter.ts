import { TemplateSendNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import {
  TemplateMessageSender,
  TemplateSendResult,
} from '@/modules/thinkzap/domain/ports/template-message-sender.port'

/**
 * Implementação *unsupported* do envio de template, para provider que não o
 * oferece — hoje a Z-API, que não expõe templates da Meta.
 *
 * Existe para que o resolver sempre devolva um sender: o chamador checa
 * `supportsTemplateSend` (ou simplesmente chama e recebe erro tipado) em vez de
 * lidar com `undefined`. Mesmo formato de `ZApiTemplateProvider`, que faz isso
 * para o ciclo de vida do catálogo.
 */
export class UnsupportedTemplateSender implements TemplateMessageSender {
  readonly supportsTemplateSend = false

  constructor(private readonly provider: string) {}

  send(): Promise<TemplateSendResult> {
    throw new TemplateSendNotSupportedError(this.provider)
  }
}
