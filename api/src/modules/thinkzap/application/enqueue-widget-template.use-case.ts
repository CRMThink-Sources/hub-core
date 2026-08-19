import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { TemplateMessageSenderResolver } from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'
import { WidgetSendQueue } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { EnqueueTemplateSendService } from './enqueue-template-send.service'
import {
  EnqueueWidgetTemplateResult,
  SendWidgetTemplateInput,
} from './send-widget-template.types'

/**
 * Aceita o envio de um template pelo widget e o torna **durável** antes de responder.
 *
 * Substitui `SendWidgetTemplateUseCase`, que entregava dentro do request. O motivo é o
 * mesmo que tirou o envio livre de lá, e aqui pesa mais: um `500` transitório da
 * HubMessage perdia a mensagem, o operador via um erro e, se não reenviasse na hora,
 * ninguém reenviava por ele — só que template costuma ser **cobrado pela Meta**, então
 * o reenvio manual que resolvia a perda custava dinheiro do cliente.
 *
 * A divisão com o worker é a mesma do envio livre, e por isso mesmo: aqui fica tudo que
 * o operador resolve mudando alguma coisa — linha bloqueada, linha Z-API, canal não
 * conectado, telefone inválido, provider sem configuração. Retentativa não melhora
 * nenhuma delas, e transformá-las em falha assíncrona tiraria do operador exatamente os
 * erros que ele consegue consertar.
 *
 * O que vai para o worker é o que o tempo resolve: a chamada ao provider e os efeitos
 * colaterais (histórico, conversa no canal aberto, comentário de timeline).
 *
 * A mecânica em si vive em `EnqueueTemplateSendService`, compartilhada com o robô de
 * Bizproc: as recusas e a ordem delas são as mesmas nos dois caminhos, e mantê-las
 * duplicadas foi o que já deixou o widget e a tela discordando sobre o que é uma
 * linha.
 */
export class EnqueueWidgetTemplateUseCase {
  private readonly service: EnqueueTemplateSendService

  constructor(
    getAplicationContext: GetAplicationContext,
    instances: GetInstanceRepository & CreateInstanceRepository,
    templateSenderResolver: TemplateMessageSenderResolver,
    outbox: PrismaWidgetOutboxRepository,
    sendQueue: WidgetSendQueue,
  ) {
    this.service = new EnqueueTemplateSendService(
      getAplicationContext,
      instances,
      templateSenderResolver,
      outbox,
      sendQueue,
    )
  }

  async execute(
    input: SendWidgetTemplateInput,
  ): Promise<EnqueueWidgetTemplateResult> {
    const target = await this.service.resolveTarget({
      subscriptionItemId: input.subscriptionItemId,
      domainId: input.domainId,
      appCode: input.appCode,
    })

    return this.service.enqueue(target, input)
  }
}
